using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class MemberEndpointTests
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

    /// <summary>The first family of the user signed in on <paramref name="client"/>.</summary>
    private static async Task<Guid> FamilyIdAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<JsonElement[]>("/api/families"))![0].GetProperty("id").GetGuid();

    /// <summary>A new invitation link created by the member signed in on <paramref name="client"/>; returns its token.</summary>
    private static async Task<string> InviteAsync(HttpClient client)
    {
        var response = await client.PostAsync($"/api/families/{await FamilyIdAsync(client)}/invitations", null);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }

    private async Task<HttpResponseMessage> RegisterWithAsync(HttpClient client, string name) =>
        await client.PostAsJsonAsync(
            $"/api/auth/invitations/{await InviteAsync(_admin)}/register",
            new { email = $"{name.ToLowerInvariant()}@mail.com", displayName = name, password = Password, language = "en" });

    /// <summary>A member joins through an invitation from Anna and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterAsync(string name)
    {
        var client = NewClient();
        var response = await RegisterWithAsync(client, name);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private static async Task<JsonElement[]> MembersAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/members");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    private static IEnumerable<string?> Names(IEnumerable<JsonElement> members) =>
        members.Select(m => m.GetProperty("displayName").GetString());

    private static Task<HttpResponseMessage> RemoveAsync(HttpClient client, Guid id) =>
        client.PostAsync($"/api/members/{id}/remove", null);

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Test]
    public async Task Any_member_lists_the_members_without_disabled_or_deleted_accounts()
    {
        var (ben, benId) = await RegisterAsync("Ben");
        var (_, chloeId) = await RegisterAsync("Chloe");
        var (dan, _) = await RegisterAsync("Dan");
        await _admin.PostAsync($"/api/admin/users/{chloeId}/disable", null);
        var deleted = await dan.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deleted.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var members = await MembersAsync(ben);

        Assert.That(Names(members), Is.EqualTo(new[] { "Anna", "Ben" }));
        Assert.That(members[0].GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
        Assert.That(members[0].GetProperty("email").GetString(), Is.EqualTo("anna@mail.com"));
        Assert.That(members[0].GetProperty("isAdmin").GetBoolean(), Is.True);
        Assert.That(members[1].GetProperty("id").GetGuid(), Is.EqualTo(benId));
        Assert.That(members[1].GetProperty("isAdmin").GetBoolean(), Is.False);
        Assert.That(
            members[1].EnumerateObject().Select(p => p.Name),
            Is.EquivalentTo(new[] { "id", "displayName", "email", "isAdmin" }));
    }

    [Test]
    public async Task Member_endpoints_need_a_session()
    {
        using var anonymous = NewClient();

        Assert.That((await anonymous.GetAsync("/api/members")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await RemoveAsync(anonymous, _annaId)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Admin_removes_a_member_who_loses_access_while_their_entries_stay()
    {
        var (ben, benId) = await RegisterAsync("Ben");
        var benInvitation = await InviteAsync(ben);
        var baby = await TestBabies.PostAsync(ben, new { name = "Léa", birthDate = "2026-09-01" });
        Assert.That(baby.StatusCode, Is.EqualTo(HttpStatusCode.Created));

        var response = await RemoveAsync(_admin, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna" }));
        Assert.That((await ben.GetAsync("/api/members")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "sessions ended");
        var login = await NewClient().PostAsJsonAsync("/api/auth/login", new { email = "ben@mail.com", password = Password });
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(login), Is.EqualTo("accountDisabled"));

        var lookup = await NewClient().GetAsync($"/api/auth/invitations/{benInvitation}");
        Assert.That(lookup.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(lookup), Is.EqualTo("invitationRevoked"));

        var babies = await (await _admin.GetAsync("/api/babies")).Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.That(babies!.Select(b => b.GetProperty("name").GetString()), Is.EqualTo(new[] { "Léa" }));
    }

    [Test]
    public async Task Remove_is_idempotent()
    {
        var (_, benId) = await RegisterAsync("Ben");

        Assert.That((await RemoveAsync(_admin, benId)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That((await RemoveAsync(_admin, benId)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
    }

    [Test]
    public async Task Non_admin_cannot_remove_a_member()
    {
        var (ben, _) = await RegisterAsync("Ben");
        var (_, chloeId) = await RegisterAsync("Chloe");

        var response = await RemoveAsync(ben, chloeId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("adminOnly"));
        Assert.That(Names(await MembersAsync(_admin)), Does.Contain("Chloe"));
    }

    [Test]
    public async Task Admin_cannot_remove_themselves()
    {
        var response = await RemoveAsync(_admin, _annaId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("adminCannotDisable"));
        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna" }));
    }

    [Test]
    public async Task Removing_an_unknown_or_deleted_user_is_404()
    {
        var (dan, danId) = await RegisterAsync("Dan");
        await dan.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });

        foreach (var id in new[] { Guid.NewGuid(), danId })
        {
            var response = await RemoveAsync(_admin, id);
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(await CodeAsync(response), Is.EqualTo("userNotFound"));
        }
    }

    [Test]
    public async Task Removed_member_comes_back_only_when_the_admin_re_enables_them()
    {
        var (_, benId) = await RegisterAsync("Ben");
        await RemoveAsync(_admin, benId);

        var again = await RegisterWithAsync(NewClient(), "Ben");
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "a new invitation can't recreate the account");
        var errors = (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("email")[0].GetString(), Is.EqualTo("taken"));

        Assert.That((await _admin.PostAsync($"/api/admin/users/{benId}/enable", null)).StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var login = await NewClient().PostAsJsonAsync("/api/auth/login", new { email = "ben@mail.com", password = Password });
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna", "Ben" }));
    }
}
