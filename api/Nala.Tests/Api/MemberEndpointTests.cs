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
    private Guid _familyId;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(DateTimeOffset.UtcNow),
        };
        _admin = _factory.Start();

        // The instance admin and admin of "Martins", signed in on _admin by setup.
        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        _familyId = (await _admin.GetFromJsonAsync<JsonElement[]>("/api/families"))![0].GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    /// <summary>A new join invitation to <paramref name="familyId"/> by the member signed in on <paramref name="client"/>; returns its token.</summary>
    private static async Task<string> InviteAsync(HttpClient client, Guid familyId)
    {
        var response = await client.PostAsync($"/api/families/{familyId}/invitations", null);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }

    /// <summary>A member joins Martins through an invitation from Anna and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterAsync(string name)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{await InviteAsync(_admin, _familyId)}/register",
            new { email = $"{name.ToLowerInvariant()}@mail.com", displayName = name, password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    /// <summary>The user signed in on <paramref name="client"/> accepts a join invitation with their account.</summary>
    private static async Task AcceptAsync(HttpClient client, string token)
    {
        var response = await client.PostAsJsonAsync($"/api/auth/invitations/{token}/accept", new { });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    private static Task<HttpResponseMessage> ListAsync(HttpClient client, Guid familyId) =>
        client.GetAsync($"/api/families/{familyId}/members");

    private async Task<JsonElement[]> MembersAsync(HttpClient client)
    {
        var response = await ListAsync(client, _familyId);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    private static IEnumerable<string?> Names(IEnumerable<JsonElement> members) =>
        members.Select(m => m.GetProperty("displayName").GetString());

    private static Task<HttpResponseMessage> RemoveAsync(HttpClient client, Guid familyId, Guid userId) =>
        client.PostAsync($"/api/families/{familyId}/members/{userId}/remove", null);

    private Task<HttpResponseMessage> RemoveAsync(HttpClient client, Guid userId) => RemoveAsync(client, _familyId, userId);

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    private async Task DeleteAccountAsync(HttpClient client)
    {
        var deleted = await client.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deleted.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
    }

    [Test]
    public async Task Any_member_lists_the_family_members_admin_first_without_deleted_accounts()
    {
        var (ben, benId) = await RegisterAsync("Ben");
        var (dan, _) = await RegisterAsync("Dan");
        await DeleteAccountAsync(dan);
        // Carl's family isn't listed, and Ben being in it changes nothing.
        using var carl = await OtherFamily.CreateAsync(_factory);
        await AcceptAsync(ben, await InviteAsync(carl.Client, carl.FamilyId));
        await RegisterAsync("aaron");

        var members = await MembersAsync(ben);

        Assert.That(Names(members), Is.EqualTo(new[] { "Anna", "aaron", "Ben" }));
        Assert.That(members[0].GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
        Assert.That(members[0].GetProperty("email").GetString(), Is.EqualTo("anna@mail.com"));
        Assert.That(members.Select(m => m.GetProperty("isAdmin").GetBoolean()), Is.EqualTo(new[] { true, false, false }));
        Assert.That(members[2].GetProperty("id").GetGuid(), Is.EqualTo(benId));
        Assert.That(
            members[2].EnumerateObject().Select(p => p.Name),
            Is.EquivalentTo(new[] { "id", "displayName", "email", "isAdmin" }));
    }

    [Test]
    public async Task IsAdmin_is_the_family_admin_not_the_instance_admin()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        await AcceptAsync(_admin, await InviteAsync(carl.Client, carl.FamilyId));

        var response = await ListAsync(_admin, carl.FamilyId);

        var members = (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
        Assert.That(
            members.Select(m => (m.GetProperty("displayName").GetString(), m.GetProperty("isAdmin").GetBoolean())),
            Is.EqualTo(new[] { ("Carl", true), ("Anna", false) }));
    }

    [Test]
    public async Task Another_familys_members_are_familyNotFound()
    {
        var (_, benId) = await RegisterAsync("Ben");
        using var carl = await OtherFamily.CreateAsync(_factory);

        foreach (var familyId in new[] { _familyId, Guid.NewGuid() })
        {
            var list = await ListAsync(carl.Client, familyId);
            Assert.That(list.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(await CodeAsync(list), Is.EqualTo("familyNotFound"));

            var remove = await RemoveAsync(carl.Client, familyId, benId);
            Assert.That(remove.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(await CodeAsync(remove), Is.EqualTo("familyNotFound"));
        }

        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna", "Ben" }));
    }

    [Test]
    public async Task Member_endpoints_need_a_session()
    {
        using var anonymous = NewClient();

        Assert.That((await ListAsync(anonymous, _familyId)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await RemoveAsync(anonymous, _annaId)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Family_admin_removes_a_member_who_loses_that_family_only()
    {
        var (ben, benId) = await RegisterAsync("Ben");
        using var carl = await OtherFamily.CreateAsync(_factory);
        await AcceptAsync(ben, await InviteAsync(carl.Client, carl.FamilyId));
        var lea = await ben.PostAsJsonAsync("/api/babies", new { familyId = _familyId, name = "Léa", birthDate = "2026-09-01" });
        Assert.That(lea.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var tom = await carl.Client.PostAsJsonAsync("/api/babies", new { familyId = carl.FamilyId, name = "Tom", birthDate = "2026-08-01" });
        Assert.That(tom.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var invitationToMartins = await InviteAsync(ben, _familyId);
        var invitationToOthers = await InviteAsync(ben, carl.FamilyId);

        var response = await RemoveAsync(_admin, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna" }));

        // Ben keeps his session and his other family, and no longer reaches Martins.
        var families = await ben.GetFromJsonAsync<JsonElement[]>("/api/families");
        Assert.That(families!.Select(f => f.GetProperty("name").GetString()), Is.EqualTo(new[] { "Others" }));
        var babies = await ben.GetFromJsonAsync<JsonElement[]>("/api/babies");
        Assert.That(babies!.Select(b => b.GetProperty("name").GetString()), Is.EqualTo(new[] { "Tom" }));
        Assert.That((await ListAsync(ben, _familyId)).StatusCode, Is.EqualTo(HttpStatusCode.NotFound));

        // Only his pending invitation to Martins is revoked.
        var lookup = await NewClient().GetAsync($"/api/auth/invitations/{invitationToMartins}");
        Assert.That(lookup.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(lookup), Is.EqualTo("invitationRevoked"));
        Assert.That(
            (await NewClient().GetAsync($"/api/auth/invitations/{invitationToOthers}")).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        // The baby he added stays in Martins.
        var martinsBabies = await _admin.GetFromJsonAsync<JsonElement[]>("/api/babies");
        Assert.That(martinsBabies!.Select(b => b.GetProperty("name").GetString()), Is.EqualTo(new[] { "Léa" }));
    }

    [Test]
    public async Task A_member_who_isnt_the_family_admin_cannot_remove_anyone()
    {
        var (ben, _) = await RegisterAsync("Ben");
        var (_, chloeId) = await RegisterAsync("Chloe");

        foreach (var id in new[] { chloeId, _annaId, Guid.NewGuid() })
        {
            var response = await RemoveAsync(ben, id);
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(await CodeAsync(response), Is.EqualTo("familyAdminOnly"));
        }

        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna", "Ben", "Chloe" }));
    }

    [Test]
    public async Task The_instance_admin_as_a_plain_member_cannot_remove_anyone()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        var (ben, benId) = await RegisterAsync("Ben");
        await AcceptAsync(ben, await InviteAsync(carl.Client, carl.FamilyId));
        await AcceptAsync(_admin, await InviteAsync(carl.Client, carl.FamilyId));

        var response = await RemoveAsync(_admin, carl.FamilyId, benId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("familyAdminOnly"));
    }

    [Test]
    public async Task Family_admin_cannot_remove_themselves()
    {
        var response = await RemoveAsync(_admin, _annaId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await CodeAsync(response), Is.EqualTo("adminCannotRemove"));
        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna" }));
    }

    [Test]
    public async Task Removing_someone_not_in_the_family_is_userNotFound()
    {
        var (_, benId) = await RegisterAsync("Ben");
        var (dan, danId) = await RegisterAsync("Dan");
        await DeleteAccountAsync(dan);
        using var carl = await OtherFamily.CreateAsync(_factory);
        Assert.That((await RemoveAsync(_admin, benId)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        foreach (var id in new[] { Guid.NewGuid(), carl.UserId, benId, danId })
        {
            var response = await RemoveAsync(_admin, id);
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), id.ToString());
            Assert.That(await CodeAsync(response), Is.EqualTo("userNotFound"));
        }
    }

    [Test]
    public async Task A_removed_member_comes_back_only_through_a_new_join_invitation()
    {
        var (ben, benId) = await RegisterAsync("Ben");
        await RemoveAsync(_admin, benId);
        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna" }));

        await AcceptAsync(ben, await InviteAsync(_admin, _familyId));

        Assert.That(Names(await MembersAsync(_admin)), Is.EqualTo(new[] { "Anna", "Ben" }));
    }
}
