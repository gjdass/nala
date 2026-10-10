using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class AccountEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Guid _annaId;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(DateTimeOffset.UtcNow),
        };
        _client = _factory.Start();

        // The admin, signed in on _client by setup.
        var response = await _client.PostAsJsonAsync(
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

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string password = Password) =>
        client.PostAsJsonAsync("/api/auth/login", new { email = "anna@mail.com", password });

    private static async Task<JsonElement> UserAsync(HttpClient client) =>
        (await (await client.GetAsync("/api/auth/state")).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user");

    private static async Task<JsonElement> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
    }

    /// <summary>Seeds an invitation from Anna (created in 03 later); returns its token.</summary>
    private async Task<string> InviteAsync()
    {
        var token = LinkToken.Generate();
        var now = _factory.Time!.GetUtcNow();
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            CreatedByUserId = _annaId,
            CreatedAt = now,
            ExpiresAt = now + InvitationPolicy.Lifetime,
        });
        return token;
    }

    /// <summary>Ben joins through an invitation and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterBenAsync()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{await InviteAsync()}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private static Task<HttpResponseMessage> LoginBenAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/auth/login", new { email = "ben@mail.com", password = Password });

    private static Task<HttpResponseMessage> DeleteAccountAsync(HttpClient client, string? password = Password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password }) });

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    private async Task<User?> UserByIdAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IUserRepository>().GetByIdAsync(id);
    }

    private Task<HttpResponseMessage> ChangePasswordAsync(HttpClient client, string currentPassword, string newPassword) =>
        client.PostAsJsonAsync("/api/account/password", new { currentPassword, newPassword });

    [Test]
    public async Task Patch_account_updates_and_returns_the_user()
    {
        var response = await _client.PatchAsJsonAsync("/api/account", new { displayName = " Anna B. ", language = "fr" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("displayName").GetString(), Is.EqualTo("Anna B."));
        Assert.That(body.GetProperty("language").GetString(), Is.EqualTo("fr"));

        var user = await UserAsync(_client);
        Assert.That(user.GetProperty("displayName").GetString(), Is.EqualTo("Anna B."));
        Assert.That(user.GetProperty("language").GetString(), Is.EqualTo("fr"));
    }

    [Test]
    public async Task Patch_account_leaves_omitted_fields_unchanged()
    {
        var response = await _client.PatchAsJsonAsync("/api/account", new { language = "fr" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await UserAsync(_client)).GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
    }

    [Test]
    public async Task Patch_account_with_invalid_fields_returns_a_validation_problem()
    {
        var errors = await ErrorsAsync(await _client.PatchAsJsonAsync("/api/account", new { displayName = " ", language = "de" }));

        Assert.That(errors.GetProperty("displayName")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("language")[0].GetString(), Is.EqualTo("invalid"));
        Assert.That((await UserAsync(_client)).GetProperty("language").GetString(), Is.EqualTo("en"));
    }

    [Test]
    public async Task Change_password_then_login_works_with_the_new_password_only()
    {
        var response = await ChangePasswordAsync(_client, Password, "battery staple");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        using var other = NewClient();
        Assert.That((await LoginAsync(other)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await LoginAsync(other, "battery staple")).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Change_password_ends_other_sessions_but_keeps_this_one()
    {
        using var tablet = NewClient();
        await LoginAsync(tablet);

        await ChangePasswordAsync(_client, Password, "battery staple");

        Assert.That((await UserAsync(_client)).ValueKind, Is.EqualTo(JsonValueKind.Object), "this session");
        Assert.That((await UserAsync(tablet)).ValueKind, Is.EqualTo(JsonValueKind.Null), "other session");
    }

    [Test]
    public async Task Change_password_with_wrong_current_password_returns_incorrect()
    {
        var errors = await ErrorsAsync(await ChangePasswordAsync(_client, "wrong password", "battery staple"));

        Assert.That(errors.GetProperty("currentPassword")[0].GetString(), Is.EqualTo("incorrect"));
        using var other = NewClient();
        Assert.That((await LoginAsync(other)).StatusCode, Is.EqualTo(HttpStatusCode.OK), "password unchanged");
    }

    [Test]
    public async Task Change_password_with_a_short_new_password_returns_tooShort()
    {
        var errors = await ErrorsAsync(await ChangePasswordAsync(_client, Password, "short"));

        Assert.That(errors.GetProperty("newPassword")[0].GetString(), Is.EqualTo("tooShort"));
    }

    [Test]
    public async Task Account_endpoints_require_a_session()
    {
        using var anonymous = NewClient();

        var patch = await anonymous.PatchAsJsonAsync("/api/account", new { language = "fr" });
        var password = await ChangePasswordAsync(anonymous, Password, "battery staple");
        var delete = await DeleteAccountAsync(anonymous);

        Assert.That(patch.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(password.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Delete_account_returns_204_and_signs_out_this_device()
    {
        var (ben, _) = await RegisterBenAsync();
        using var _ = ben;

        var response = await DeleteAccountAsync(ben);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That((await UserAsync(ben)).ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Delete_account_ends_sessions_on_other_devices()
    {
        var (ben, _) = await RegisterBenAsync();
        using var _ = ben;
        using var tablet = NewClient();
        Assert.That((await LoginBenAsync(tablet)).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        await DeleteAccountAsync(ben);

        Assert.That((await UserAsync(tablet)).ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That((await tablet.PatchAsJsonAsync("/api/account", new { language = "fr" })).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Deleted_account_can_no_longer_log_in()
    {
        var (ben, _) = await RegisterBenAsync();
        using var _ = ben;

        await DeleteAccountAsync(ben);

        using var other = NewClient();
        var login = await LoginBenAsync(other);
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(await CodeAsync(login), Is.EqualTo("invalidCredentials"));
    }

    [Test]
    public async Task Deleted_account_email_can_be_invited_again()
    {
        var (ben, oldId) = await RegisterBenAsync();
        using var _ = ben;
        await DeleteAccountAsync(ben);

        var (again, newId) = await RegisterBenAsync();
        using var __ = again;

        Assert.That(newId, Is.Not.EqualTo(oldId));
        using var other = NewClient();
        Assert.That((await LoginBenAsync(other)).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Deleted_account_keeps_its_display_name_and_what_references_it()
    {
        var (ben, id) = await RegisterBenAsync();
        using var _ = ben;

        await DeleteAccountAsync(ben);

        var deleted = await UserByIdAsync(id);
        Assert.That(deleted, Is.Not.Null, "the account row is kept so entries still show who logged them");
        Assert.That(deleted!.DisplayName, Is.EqualTo("Ben"));
        Assert.That(deleted.Email, Is.Null);
        Assert.That(deleted.PasswordHash, Is.Null);
        Assert.That(deleted.DeletedAt, Is.Not.Null);
    }

    [Test]
    public async Task Delete_account_revokes_the_users_pending_invitations()
    {
        var (ben, id) = await RegisterBenAsync();
        using var _ = ben;
        var token = LinkToken.Generate();
        var now = _factory.Time!.GetUtcNow();
        using (var scope = _factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
            {
                Id = Guid.NewGuid(),
                TokenHash = LinkToken.Hash(token),
                CreatedByUserId = id,
                CreatedAt = now,
                ExpiresAt = now + InvitationPolicy.Lifetime,
            });
        }

        await DeleteAccountAsync(ben);

        using var visitor = NewClient();
        var lookup = await visitor.GetAsync($"/api/auth/invitations/{token}");
        Assert.That(lookup.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(lookup), Is.EqualTo("invitationRevoked"));
    }

    [Test]
    public async Task Delete_account_with_wrong_password_returns_incorrect()
    {
        var (ben, _) = await RegisterBenAsync();
        using var _ = ben;

        var errors = await ErrorsAsync(await DeleteAccountAsync(ben, "wrong password"));

        Assert.That(errors.GetProperty("password")[0].GetString(), Is.EqualTo("incorrect"));
        Assert.That((await UserAsync(ben)).ValueKind, Is.EqualTo(JsonValueKind.Object), "still signed in");
        using var other = NewClient();
        Assert.That((await LoginBenAsync(other)).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Delete_account_without_password_returns_required()
    {
        var (ben, _) = await RegisterBenAsync();
        using var _ = ben;

        var errors = await ErrorsAsync(await DeleteAccountAsync(ben, null));

        Assert.That(errors.GetProperty("password")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task Admin_cannot_delete_their_account()
    {
        var response = await DeleteAccountAsync(_client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("adminCannotDelete"));
        Assert.That((await UserAsync(_client)).ValueKind, Is.EqualTo(JsonValueKind.Object), "still signed in");
    }
}
