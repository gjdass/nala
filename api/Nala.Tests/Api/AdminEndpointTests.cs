using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class AdminEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
    private Guid _annaId;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(DateTimeOffset.UtcNow),
        };
        _admin = _factory.Start();

        // The admin, signed in on _admin by setup.
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

    /// <summary>A member joins through an invitation and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterAsync(string name)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{await InviteAsync()}/register",
            new { email = $"{name.ToLowerInvariant()}@mail.com", displayName = name, password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email) =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });

    private static async Task<JsonElement[]> UsersAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/admin/users");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    private static Task<HttpResponseMessage> DisableAsync(HttpClient client, Guid id) =>
        client.PostAsync($"/api/admin/users/{id}/disable", null);

    private static Task<HttpResponseMessage> EnableAsync(HttpClient client, Guid id) =>
        client.PostAsync($"/api/admin/users/{id}/enable", null);

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Test]
    public async Task Admin_lists_users_with_their_fields()
    {
        var (_, benId) = await RegisterAsync("Ben");

        var users = await UsersAsync(_admin);

        Assert.That(users.Select(u => u.GetProperty("displayName").GetString()), Is.EqualTo(new[] { "Anna", "Ben" }));
        var ben = users[1];
        Assert.That(ben.GetProperty("id").GetGuid(), Is.EqualTo(benId));
        Assert.That(ben.GetProperty("email").GetString(), Is.EqualTo("ben@mail.com"));
        Assert.That(ben.GetProperty("isAdmin").GetBoolean(), Is.False);
        Assert.That(ben.GetProperty("isDisabled").GetBoolean(), Is.False);
        Assert.That(
            ben.GetProperty("lastActivityAt").GetDateTimeOffset(),
            Is.EqualTo(_factory.Time!.GetUtcNow()).Within(TimeSpan.FromMilliseconds(1)),
            "set when Ben signed in");
    }

    [Test]
    public async Task Deleted_users_are_not_listed()
    {
        var (ben, _) = await RegisterAsync("Ben");
        var deleted = await ben.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deleted.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var users = await UsersAsync(_admin);

        Assert.That(users.Select(u => u.GetProperty("displayName").GetString()), Is.EqualTo(new[] { "Anna" }));
    }

    [Test]
    public async Task Exactly_one_user_is_admin_and_it_is_the_setup_account()
    {
        await RegisterAsync("Ben");
        await RegisterAsync("Chloe");

        var admins = (await UsersAsync(_admin)).Where(u => u.GetProperty("isAdmin").GetBoolean()).ToList();

        Assert.That(admins.Select(u => u.GetProperty("id").GetGuid()), Is.EqualTo(new[] { _annaId }));
    }

    [Test]
    public async Task Non_admin_gets_403_on_every_admin_endpoint()
    {
        var (ben, _) = await RegisterAsync("Ben");
        var (_, chloeId) = await RegisterAsync("Chloe");

        foreach (var response in new[]
                 {
                     await ben.GetAsync("/api/admin/users"),
                     await DisableAsync(ben, chloeId),
                     await EnableAsync(ben, chloeId),
                 })
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(await CodeAsync(response), Is.EqualTo("adminOnly"));
        }

        Assert.That((await UsersAsync(_admin)).Single(u => u.GetProperty("id").GetGuid() == chloeId).GetProperty("isDisabled").GetBoolean(), Is.False);
    }

    [Test]
    public async Task Admin_endpoints_need_a_session()
    {
        using var anonymous = NewClient();

        Assert.That((await anonymous.GetAsync("/api/admin/users")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await DisableAsync(anonymous, _annaId)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Disabling_ends_the_users_sessions_and_blocks_login()
    {
        var (ben, benId) = await RegisterAsync("Ben");

        var response = await DisableAsync(_admin, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("id").GetGuid(), Is.EqualTo(benId));
        Assert.That(body.GetProperty("isDisabled").GetBoolean(), Is.True);

        Assert.That(
            (await ben.PatchAsJsonAsync("/api/account", new { displayName = "Ben" })).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized),
            "the existing session stopped working");

        var login = await LoginAsync(NewClient(), "ben@mail.com");
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(login), Is.EqualTo("accountDisabled"));
    }

    [Test]
    public async Task Disabled_account_with_a_wrong_password_gets_the_generic_error()
    {
        var (_, benId) = await RegisterAsync("Ben");
        await DisableAsync(_admin, benId);

        var login = await NewClient().PostAsJsonAsync("/api/auth/login", new { email = "ben@mail.com", password = "wrong password" });

        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(await CodeAsync(login), Is.EqualTo("invalidCredentials"));
    }

    [Test]
    public async Task Re_enabling_lets_the_user_log_in_again()
    {
        var (_, benId) = await RegisterAsync("Ben");
        await DisableAsync(_admin, benId);

        var response = await EnableAsync(_admin, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("isDisabled").GetBoolean(), Is.False);
        Assert.That((await LoginAsync(NewClient(), "ben@mail.com")).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Admin_cannot_disable_themselves()
    {
        var response = await DisableAsync(_admin, _annaId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("adminCannotDisable"));
        Assert.That((await UsersAsync(_admin)).Single().GetProperty("isDisabled").GetBoolean(), Is.False);
    }

    [Test]
    public async Task Unknown_user_is_404()
    {
        var response = await DisableAsync(_admin, Guid.NewGuid());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(response), Is.EqualTo("userNotFound"));
    }
}
