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
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
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

    /// <summary>Seeds a new-family invitation from Anna; returns its token.</summary>
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

    /// <summary>Someone creates their family through a new-family invitation and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterAsync(string name)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{await InviteAsync()}/register",
            new { email = $"{name.ToLowerInvariant()}@mail.com", displayName = name, password = Password, language = "en", familyName = name });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private static async Task<JsonElement[]> UsersAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/admin/users");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    private static Task<HttpResponseMessage> ResetLinkAsync(HttpClient client, Guid id) =>
        client.PostAsync($"/api/admin/users/{id}/reset-link", null);

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Test]
    public async Task Admin_lists_the_accounts_of_every_family_without_family_data()
    {
        var (_, benId) = await RegisterAsync("Ben");
        using var carl = await OtherFamily.CreateAsync(_factory);

        var users = await UsersAsync(_admin);

        Assert.That(users.Select(u => u.GetProperty("displayName").GetString()), Is.EqualTo(new[] { "Anna", "Ben", "Carl" }));
        var ben = users[1];
        Assert.That(
            ben.EnumerateObject().Select(p => p.Name),
            Is.EquivalentTo(new[] { "id", "displayName", "email", "isAdmin", "lastActivityAt" }));
        Assert.That(ben.GetProperty("id").GetGuid(), Is.EqualTo(benId));
        Assert.That(ben.GetProperty("email").GetString(), Is.EqualTo("ben@mail.com"));
        Assert.That(ben.GetProperty("isAdmin").GetBoolean(), Is.False);
        Assert.That(users[2].GetProperty("id").GetGuid(), Is.EqualTo(carl.UserId));
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
                     await ResetLinkAsync(ben, chloeId),
                 })
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(await CodeAsync(response), Is.EqualTo("adminOnly"));
        }
    }

    [Test]
    public async Task Admin_endpoints_need_a_session()
    {
        using var anonymous = NewClient();

        Assert.That((await anonymous.GetAsync("/api/admin/users")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await ResetLinkAsync(anonymous, _annaId)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Disable_and_enable_endpoints_are_gone()
    {
        var (_, benId) = await RegisterAsync("Ben");

        Assert.That((await _admin.PostAsync($"/api/admin/users/{benId}/disable", null)).StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await _admin.PostAsync($"/api/admin/users/{benId}/enable", null)).StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
    }
}
