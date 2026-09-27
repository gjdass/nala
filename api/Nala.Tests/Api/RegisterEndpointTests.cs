using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class RegisterEndpointTests
{
    private const string Password = "correct horse battery";

    private FixedTimeProvider _time = null!;
    private NalaApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Guid _annaId;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _time = new FixedTimeProvider(DateTimeOffset.UtcNow);
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container)) { Time = _time };
        _client = _factory.Start();

        // The admin signs up on another client; _client stays signed out.
        using var setup = NewClient();
        var response = await setup.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    /// <summary>Seeds an invitation from Anna (created in 03 later); returns its token.</summary>
    private async Task<string> InviteAsync(Action<Invitation>? change = null)
    {
        var token = InvitationToken.Generate();
        var now = _time.GetUtcNow();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = InvitationToken.Hash(token),
            CreatedByUserId = _annaId,
            CreatedAt = now,
            ExpiresAt = now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(invitation);
        return token;
    }

    private static object Registration(string email = "Ben@Mail.com ", string displayName = " Ben ", string password = Password) =>
        new { email, displayName, password, language = "fr" };

    private Task<HttpResponseMessage> RegisterAsync(string token, object? registration = null, HttpClient? client = null) =>
        (client ?? _client).PostAsJsonAsync($"/api/auth/invitations/{token}/register", registration ?? Registration());

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    private static async Task<Dictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;

    private async Task<User?> UserAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IUserRepository>().GetByEmailAsync(email);
    }

    [Test]
    public async Task Lookup_of_a_valid_invitation_returns_the_inviter_and_expiry()
    {
        var response = await _client.GetAsync($"/api/auth/invitations/{await InviteAsync()}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("invitedBy").GetString(), Is.EqualTo("Anna"));
        Assert.That(
            body.GetProperty("expiresAt").GetDateTimeOffset(),
            Is.EqualTo(_time.GetUtcNow() + TimeSpan.FromDays(7)).Within(TimeSpan.FromMilliseconds(1)));
    }

    [Test]
    public async Task Lookup_of_an_unknown_invitation_is_404()
    {
        var response = await _client.GetAsync("/api/auth/invitations/unknown");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(response), Is.EqualTo("invitationUnknown"));
    }

    [Test]
    public async Task Lookup_of_an_unavailable_invitation_is_410_with_its_reason()
    {
        var expired = await InviteAsync(i => i.ExpiresAt = _time.GetUtcNow());
        var revoked = await InviteAsync(i => i.RevokedAt = _time.GetUtcNow());
        var used = await InviteAsync();
        Assert.That((await RegisterAsync(used)).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        foreach (var (token, code) in new[] { (expired, "invitationExpired"), (revoked, "invitationRevoked"), (used, "invitationUsed") })
        {
            var response = await NewClient().GetAsync($"/api/auth/invitations/{token}");
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone), code);
            Assert.That(await CodeAsync(response), Is.EqualTo(code));
        }
    }

    [Test]
    public async Task Register_creates_a_member_and_signs_them_in()
    {
        var response = await RegisterAsync(await InviteAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("nala.session=")).ToLowerInvariant();
        Assert.That(cookie, Does.Contain("httponly").And.Contain("secure").And.Contain("samesite=strict"));

        var state = await (await _client.GetAsync("/api/auth/state")).Content.ReadFromJsonAsync<JsonElement>();
        var user = state.GetProperty("user");
        Assert.That(user.GetProperty("email").GetString(), Is.EqualTo("ben@mail.com"));
        Assert.That(user.GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        Assert.That(user.GetProperty("language").GetString(), Is.EqualTo("fr"));
        Assert.That(user.GetProperty("isAdmin").GetBoolean(), Is.False);
    }

    [Test]
    public async Task Invitation_link_is_single_use()
    {
        var token = await InviteAsync();
        await RegisterAsync(token);

        var response = await RegisterAsync(token, Registration(email: "carl@mail.com"), NewClient());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(response), Is.EqualTo("invitationUsed"));
        Assert.That(await UserAsync("carl@mail.com"), Is.Null);
    }

    [Test]
    public async Task Invitation_link_expires_after_7_days()
    {
        var token = await InviteAsync();
        _time.Now += TimeSpan.FromDays(7);

        var response = await RegisterAsync(token);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(response), Is.EqualTo("invitationExpired"));
        Assert.That(await UserAsync("ben@mail.com"), Is.Null);
    }

    [Test]
    public async Task Register_with_an_unknown_token_is_refused()
    {
        var response = await RegisterAsync("unknown");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(response), Is.EqualTo("invitationUnknown"));
        Assert.That(await UserAsync("ben@mail.com"), Is.Null);
    }

    [Test]
    public async Task Register_with_a_revoked_invitation_is_refused()
    {
        var response = await RegisterAsync(await InviteAsync(i => i.RevokedAt = _time.GetUtcNow()));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(response), Is.EqualTo("invitationRevoked"));
    }

    [Test]
    public async Task Email_with_an_account_is_refused_as_taken()
    {
        var response = await RegisterAsync(await InviteAsync(), Registration(email: " ANNA@mail.com"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(await ErrorsAsync(response), Is.EquivalentTo(new Dictionary<string, string[]> { ["email"] = ["taken"] }));
    }

    [Test]
    public async Task Invalid_fields_are_a_validation_problem()
    {
        var response = await RegisterAsync(await InviteAsync(), Registration(email: "ben", displayName: "", password: "short"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(await ErrorsAsync(response), Is.EquivalentTo(new Dictionary<string, string[]>
        {
            ["email"] = ["invalid"],
            ["displayName"] = ["required"],
            ["password"] = ["tooShort"],
        }));
    }

    [Test]
    public async Task Setup_stays_refused_so_there_is_no_public_sign_up()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/setup", Registration());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await UserAsync("ben@mail.com"), Is.Null);
    }
}
