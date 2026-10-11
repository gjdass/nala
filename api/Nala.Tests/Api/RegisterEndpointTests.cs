using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Sql;
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
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
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

    /// <summary>Seeds a join invitation from Anna to her family (or a new-family one); returns its token.</summary>
    private async Task<string> InviteAsync(Action<Invitation>? change = null, bool newFamily = false)
    {
        var token = LinkToken.Generate();
        var now = _time.GetUtcNow();
        using var scope = _factory.Services.CreateScope();
        var family = await scope.ServiceProvider.GetRequiredService<NalaDbContext>().Set<Family>().SingleOrDefaultAsync(f => f.Name == "Martins");
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            FamilyId = newFamily ? null : family?.Id,
            CreatedByUserId = _annaId,
            CreatedAt = now,
            ExpiresAt = now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
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
    public async Task Register_joins_the_inviters_family_as_a_member()
    {
        await RegisterAsync(await InviteAsync());

        var families = await (await _client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(families.GetArrayLength(), Is.EqualTo(1));
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("Martins"));
        Assert.That(families[0].GetProperty("isAdmin").GetBoolean(), Is.False);
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

    private Task<HttpResponseMessage> AcceptAsync(string token, HttpClient client) =>
        client.PostAsJsonAsync($"/api/auth/invitations/{token}/accept", new { });

    private async Task<HttpClient> AnnaAsync()
    {
        var anna = NewClient();
        var response = await anna.PostAsJsonAsync("/api/auth/login", new { email = "anna@mail.com", password = Password });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return anna;
    }

    private async Task<Guid> MartinsIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<NalaDbContext>().Set<Family>().SingleAsync(f => f.Name == "Martins")).Id;
    }

    [Test]
    public async Task Lookup_returns_kind_and_family_name()
    {
        var body = await (await _client.GetAsync($"/api/auth/invitations/{await InviteAsync()}")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.That(body.GetProperty("kind").GetString(), Is.EqualTo("join"));
        Assert.That(body.GetProperty("familyName").GetString(), Is.EqualTo("Martins"));
    }

    [Test]
    public async Task Accept_joins_the_family_and_returns_its_id()
    {
        var token = await InviteAsync();
        using var carl = await OtherFamily.CreateAsync(_factory);

        var response = await AcceptAsync(token, carl.Client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var martinsId = await MartinsIdAsync();
        Assert.That((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("familyId").GetGuid(), Is.EqualTo(martinsId));
        var families = await (await carl.Client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(
            families.EnumerateArray().Select(f => (f.GetProperty("name").GetString(), f.GetProperty("isAdmin").GetBoolean())),
            Is.EqualTo(new[] { ("Martins", false), ("Others", true) }));
    }

    [Test]
    public async Task Accept_requires_a_session()
    {
        var token = await InviteAsync();

        var response = await AcceptAsync(token, _client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Accept_by_a_member_of_the_family_is_409_already_member_and_the_link_stays_usable()
    {
        var token = await InviteAsync();
        using var anna = await AnnaAsync();

        var response = await AcceptAsync(token, anna);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
        Assert.That(await CodeAsync(response), Is.EqualTo("alreadyMember"));
        using var carl = await OtherFamily.CreateAsync(_factory);
        Assert.That((await AcceptAsync(token, carl.Client)).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Accept_of_a_used_or_revoked_invitation_is_410()
    {
        var used = await InviteAsync();
        Assert.That((await RegisterAsync(used)).StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var revoked = await InviteAsync(i => i.RevokedAt = _time.GetUtcNow());
        using var carl = await OtherFamily.CreateAsync(_factory);

        foreach (var (token, code) in new[] { (used, "invitationUsed"), (revoked, "invitationRevoked") })
        {
            var response = await AcceptAsync(token, carl.Client);
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone), code);
            Assert.That(await CodeAsync(response), Is.EqualTo(code));
        }
    }

    [Test]
    public async Task Accept_of_an_unknown_invitation_is_404()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);

        var response = await AcceptAsync("unknown", carl.Client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(response), Is.EqualTo("invitationUnknown"));
    }

    [Test]
    public async Task Removed_member_comes_back_through_a_new_invitation()
    {
        Assert.That((await RegisterAsync(await InviteAsync())).StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var ben = await UserAsync("ben@mail.com");
        using (var scope = _factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<NalaDbContext>().Set<Membership>()
                .Where(m => m.UserId == ben!.Id).ExecuteDeleteAsync();
        }

        Assert.That((await (await _client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength(), Is.Zero);

        var response = await AcceptAsync(await InviteAsync(), _client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var families = await (await _client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(families.GetArrayLength(), Is.EqualTo(1));
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("Martins"));
    }

    private Task<string> InviteNewFamilyAsync() => InviteAsync(newFamily: true);

    [Test]
    public async Task Register_with_a_new_family_invitation_creates_the_family_with_them_as_its_admin()
    {
        var token = await InviteNewFamilyAsync();

        var response = await RegisterAsync(
            token, new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en", familyName = " Dupont " });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var families = await _client.GetFromJsonAsync<JsonElement[]>("/api/families");
        Assert.That(
            families!.Select(f => (f.GetProperty("name").GetString(), f.GetProperty("isAdmin").GetBoolean())),
            Is.EqualTo(new[] { ("Dupont", true) }));
        Assert.That(await _client.GetFromJsonAsync<JsonElement[]>("/api/babies"), Is.Empty);
        var user = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user");
        Assert.That(user.GetProperty("isAdmin").GetBoolean(), Is.False);
    }

    [Test]
    public async Task Register_with_a_new_family_invitation_without_family_name_is_400_and_creates_nothing()
    {
        var token = await InviteNewFamilyAsync();

        var response = await RegisterAsync(token);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await ErrorsAsync(response))["familyName"], Is.EqualTo(new[] { "required" }));
        Assert.That(await UserAsync("ben@mail.com"), Is.Null);
    }

    [Test]
    public async Task Accept_of_a_new_family_invitation_creates_the_family_for_an_existing_account()
    {
        var token = await InviteNewFamilyAsync();
        using var carl = await OtherFamily.CreateAsync(_factory);

        var response = await carl.Client.PostAsJsonAsync($"/api/auth/invitations/{token}/accept", new { familyName = "Dupont" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var familyId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("familyId").GetGuid();
        var families = await carl.Client.GetFromJsonAsync<JsonElement[]>("/api/families");
        Assert.That(
            families!.Select(f => (f.GetProperty("id").GetGuid() == familyId, f.GetProperty("name").GetString(), f.GetProperty("isAdmin").GetBoolean())),
            Is.EqualTo(new[] { (true, "Dupont", true), (false, "Others", true) }));
    }

    [Test]
    public async Task Accept_of_a_new_family_invitation_without_family_name_is_400_and_the_link_stays_usable()
    {
        var token = await InviteNewFamilyAsync();
        using var carl = await OtherFamily.CreateAsync(_factory);

        var response = await AcceptAsync(token, carl.Client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await ErrorsAsync(response))["familyName"], Is.EqualTo(new[] { "required" }));
        Assert.That((await _client.GetAsync($"/api/auth/invitations/{token}")).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }
}
