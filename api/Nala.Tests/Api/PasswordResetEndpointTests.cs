using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class PasswordResetEndpointTests
{
    private const string Password = "correct horse battery";
    private const string NewPassword = "battery staple";

    private NalaApiFactory _factory = null!;
    private FixedTimeProvider _time = null!;
    private HttpClient _admin = null!;
    private Guid _annaId;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _time = new FixedTimeProvider(DateTimeOffset.UtcNow);
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container)) { Time = _time };
        _admin = _factory.Start();

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    /// <summary>Ben joins through an invitation (created in 03 later) and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterBenAsync()
    {
        var token = LinkToken.Generate();
        var now = _time.Now;
        using (var scope = _factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
            {
                Id = Guid.NewGuid(),
                TokenHash = LinkToken.Hash(token),
                CreatedByUserId = _annaId,
                CreatedAt = now,
                ExpiresAt = now + InvitationPolicy.Lifetime,
            });
        }

        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private static Task<HttpResponseMessage> CreateLinkAsync(HttpClient client, Guid userId) =>
        client.PostAsync($"/api/admin/users/{userId}/reset-link", null);

    /// <summary>The admin creates a reset link for the user; returns its token.</summary>
    private async Task<string> ResetTokenAsync(Guid userId)
    {
        var response = await CreateLinkAsync(_admin, userId);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }

    private static Task<HttpResponseMessage> LookupAsync(HttpClient client, string token) =>
        client.GetAsync($"/api/auth/password-resets/{token}");

    private static Task<HttpResponseMessage> ResetAsync(HttpClient client, string token, string? password = NewPassword) =>
        client.PostAsJsonAsync($"/api/auth/password-resets/{token}", new { password });

    private static Task<HttpResponseMessage> LoginBenAsync(HttpClient client, string password) =>
        client.PostAsJsonAsync("/api/auth/login", new { email = "ben@mail.com", password });

    /// <summary>The signed-in user's id on this client; null when signed out.</summary>
    private static async Task<Guid?> SignedInAsAsync(HttpClient client)
    {
        var user = (await client.GetFromJsonAsync<JsonElement>("/api/auth/state")).GetProperty("user");
        return user.ValueKind == JsonValueKind.Null ? null : user.GetProperty("id").GetGuid();
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Test]
    public async Task Admin_creates_a_reset_link_valid_24_hours()
    {
        var (_, benId) = await RegisterBenAsync();

        var response = await CreateLinkAsync(_admin, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var link = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(link.GetProperty("token").GetString(), Has.Length.AtLeast(43));
        Assert.That(
            link.GetProperty("expiresAt").GetDateTimeOffset(),
            Is.EqualTo(_time.Now + TimeSpan.FromHours(24)).Within(TimeSpan.FromMilliseconds(1)));
    }

    [Test]
    public async Task A_member_cannot_create_a_reset_link()
    {
        var (ben, _) = await RegisterBenAsync();

        var response = await CreateLinkAsync(ben, _annaId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("adminOnly"));
    }

    [Test]
    public async Task A_reset_link_for_an_unknown_user_is_not_found()
    {
        var response = await CreateLinkAsync(_admin, Guid.NewGuid());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(response), Is.EqualTo("userNotFound"));
    }

    [Test]
    public async Task A_reset_link_for_a_disabled_user_is_refused()
    {
        var (_, benId) = await RegisterBenAsync();
        await _admin.PostAsync($"/api/admin/users/{benId}/disable", null);

        var response = await CreateLinkAsync(_admin, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("accountDisabled"));
    }

    [Test]
    public async Task Anyone_with_the_link_can_look_it_up()
    {
        var (_, benId) = await RegisterBenAsync();
        var token = await ResetTokenAsync(benId);
        using var anonymous = NewClient();

        var response = await LookupAsync(anonymous, token);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var lookup = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(lookup.GetProperty("email").GetString(), Is.EqualTo("ben@mail.com"));
        Assert.That(
            lookup.GetProperty("expiresAt").GetDateTimeOffset(),
            Is.EqualTo(_time.Now + TimeSpan.FromHours(24)).Within(TimeSpan.FromMilliseconds(1)));
    }

    [Test]
    public async Task Lookup_of_an_unknown_link_is_404()
    {
        using var anonymous = NewClient();

        var response = await LookupAsync(anonymous, LinkToken.Generate());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(response), Is.EqualTo("resetLinkUnknown"));
    }

    [Test]
    public async Task Lookup_of_an_expired_link_is_410()
    {
        var (_, benId) = await RegisterBenAsync();
        var token = await ResetTokenAsync(benId);
        _time.Now += TimeSpan.FromHours(24);
        using var anonymous = NewClient();

        var response = await LookupAsync(anonymous, token);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(response), Is.EqualTo("resetLinkExpired"));
    }

    [Test]
    public async Task Reset_sets_the_password_signs_in_and_ends_every_other_session()
    {
        var (ben, benId) = await RegisterBenAsync();
        var token = await ResetTokenAsync(benId);
        using var phone = NewClient();

        var response = await ResetAsync(phone, token);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var state = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(state.GetProperty("user").GetProperty("id").GetGuid(), Is.EqualTo(benId));
        Assert.That(response.Headers.GetValues("Set-Cookie"), Has.Some.StartsWith("nala.session="));
        Assert.That(await SignedInAsAsync(phone), Is.EqualTo(benId), "signed in");
        Assert.That(await SignedInAsAsync(ben), Is.Null, "other session ended");
        using var other = NewClient();
        Assert.That((await LoginBenAsync(other, Password)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await LoginBenAsync(other, NewPassword)).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task A_used_link_cannot_be_used_again()
    {
        var (_, benId) = await RegisterBenAsync();
        var token = await ResetTokenAsync(benId);
        using var phone = NewClient();
        await ResetAsync(phone, token);
        using var other = NewClient();

        var response = await ResetAsync(other, token, "a third password");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(response), Is.EqualTo("resetLinkUsed"));
        Assert.That((await LookupAsync(other, token)).StatusCode, Is.EqualTo(HttpStatusCode.Gone));
    }

    [Test]
    public async Task Reset_with_a_too_short_password_is_a_validation_problem()
    {
        var (_, benId) = await RegisterBenAsync();
        var token = await ResetTokenAsync(benId);
        using var phone = NewClient();

        var response = await ResetAsync(phone, token, "short");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("password")[0].GetString(), Is.EqualTo("tooShort"));
        Assert.That((await LookupAsync(phone, token)).StatusCode, Is.EqualTo(HttpStatusCode.OK), "link not consumed");
    }

    [Test]
    public async Task Reset_for_a_user_disabled_since_is_refused()
    {
        var (_, benId) = await RegisterBenAsync();
        var token = await ResetTokenAsync(benId);
        await _admin.PostAsync($"/api/admin/users/{benId}/disable", null);
        using var phone = NewClient();

        var response = await ResetAsync(phone, token);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("accountDisabled"));
    }
}
