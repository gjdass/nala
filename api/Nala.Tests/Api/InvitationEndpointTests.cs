using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class InvitationEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
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

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _familyId = (await _admin.GetFromJsonAsync<JsonElement[]>("/api/families"))!.Single().GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private DateTimeOffset Now => _factory.Time!.GetUtcNow();

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    private string Invitations(Guid? familyId = null) => $"/api/families/{familyId ?? _familyId}/invitations";

    private async Task<(string Token, DateTimeOffset ExpiresAt)> CreateAsync(HttpClient client, Guid? familyId = null)
    {
        var response = await client.PostAsync(Invitations(familyId), null);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (body.GetProperty("token").GetString()!, body.GetProperty("expiresAt").GetDateTimeOffset());
    }

    private async Task<JsonElement[]> PendingAsync(HttpClient client, Guid? familyId = null)
    {
        var response = await client.GetAsync(Invitations(familyId));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    private Task<HttpResponseMessage> RevokeAsync(HttpClient client, Guid id, Guid? familyId = null) =>
        client.PostAsync($"{Invitations(familyId)}/{id}/revoke", null);

    private Task<HttpResponseMessage> RegisterAsync(string token, string email, string displayName) =>
        NewClient().PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email, displayName, password = Password, language = "en" });

    /// <summary>Ben joins through a link Anna created and is signed in on the returned client.</summary>
    private async Task<HttpClient> RegisterBenAsync()
    {
        var (token, _) = await CreateAsync(_admin);
        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return client;
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Test]
    public async Task A_member_creates_a_link_valid_7_days_that_opens_the_register_page()
    {
        var (token, expiresAt) = await CreateAsync(_admin);

        Assert.That(expiresAt, Is.EqualTo(Now.AddDays(7)).Within(TimeSpan.FromSeconds(1)));
        var lookup = await NewClient().GetAsync($"/api/auth/invitations/{token}");
        Assert.That(lookup.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(
            (await lookup.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("invitedBy").GetString(),
            Is.EqualTo("Anna"));
    }

    [Test]
    public async Task A_link_is_single_use()
    {
        var (token, _) = await CreateAsync(_admin);
        Assert.That((await RegisterAsync(token, "ben@mail.com", "Ben")).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        var second = await RegisterAsync(token, "carl@mail.com", "Carl");

        Assert.That(second.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeOf(second), Is.EqualTo("invitationUsed"));
    }

    [Test]
    public async Task Pending_list_has_creator_and_expiry_newest_first_without_used_or_revoked()
    {
        using var ben = await RegisterBenAsync(); // Consumes one of Anna's links.
        await CreateAsync(_admin);
        await CreateAsync(ben);
        await CreateAsync(_admin); // Newest, then revoked.
        var revokedId = (await PendingAsync(_admin))[0].GetProperty("id").GetGuid();
        Assert.That((await RevokeAsync(_admin, revokedId)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var pending = await PendingAsync(_admin);

        Assert.That(pending.Select(i => i.GetProperty("createdBy").GetString()), Is.EqualTo(new[] { "Ben", "Anna" }));
        var first = pending[0];
        Assert.That(first.GetProperty("createdAt").GetDateTimeOffset(), Is.EqualTo(Now).Within(TimeSpan.FromSeconds(1)));
        Assert.That(
            first.GetProperty("expiresAt").GetDateTimeOffset(), Is.EqualTo(Now.AddDays(7)).Within(TimeSpan.FromSeconds(1)));
    }

    [Test]
    public async Task A_non_admin_member_can_create_list_and_revoke()
    {
        using var ben = await RegisterBenAsync();
        await CreateAsync(ben);
        var id = (await PendingAsync(ben)).Single().GetProperty("id").GetGuid();

        Assert.That((await RevokeAsync(ben, id)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(await PendingAsync(ben), Is.Empty);
    }

    [Test]
    public async Task A_revoked_link_cannot_be_used()
    {
        var (token, _) = await CreateAsync(_admin);
        var id = (await PendingAsync(_admin)).Single().GetProperty("id").GetGuid();

        Assert.That((await RevokeAsync(_admin, id)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var lookup = await NewClient().GetAsync($"/api/auth/invitations/{token}");
        Assert.That(lookup.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeOf(lookup), Is.EqualTo("invitationRevoked"));
        var register = await RegisterAsync(token, "ben@mail.com", "Ben");
        Assert.That(register.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeOf(register), Is.EqualTo("invitationRevoked"));
    }

    [Test]
    public async Task Revoking_twice_is_accepted()
    {
        await CreateAsync(_admin);
        var id = (await PendingAsync(_admin)).Single().GetProperty("id").GetGuid();
        await RevokeAsync(_admin, id);

        Assert.That((await RevokeAsync(_admin, id)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
    }

    [Test]
    public async Task A_used_invitation_cannot_be_revoked()
    {
        var (token, _) = await CreateAsync(_admin);
        var id = (await PendingAsync(_admin)).Single().GetProperty("id").GetGuid();
        await RegisterAsync(token, "ben@mail.com", "Ben");

        var response = await RevokeAsync(_admin, id);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeOf(response), Is.EqualTo("invitationUsed"));
    }

    [Test]
    public async Task Revoking_an_unknown_invitation_is_not_found()
    {
        var response = await RevokeAsync(_admin, Guid.NewGuid());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeOf(response), Is.EqualTo("invitationUnknown"));
    }

    [Test]
    public async Task Invitations_need_a_session()
    {
        using var anonymous = NewClient();

        Assert.That((await anonymous.PostAsync(Invitations(), null)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.GetAsync(Invitations())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await RevokeAsync(anonymous, Guid.NewGuid())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Another_family_cannot_create_list_or_revoke_and_gets_familyNotFound()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        await CreateAsync(_admin);
        var id = (await PendingAsync(_admin)).Single().GetProperty("id").GetGuid();

        foreach (var familyId in new[] { _familyId, Guid.NewGuid() })
        {
            await Isolation.AssertNotFoundAsync(carl.Client.PostAsync(Invitations(familyId), null), "familyNotFound", "create");
            await Isolation.AssertNotFoundAsync(carl.Client.GetAsync(Invitations(familyId)), "familyNotFound", "list");
            await Isolation.AssertNotFoundAsync(RevokeAsync(carl.Client, id, familyId), "familyNotFound", "revoke");
        }

        Assert.That(await PendingAsync(_admin), Has.Length.EqualTo(1));
    }

    [Test]
    public async Task Revoking_another_familys_invitation_through_ones_own_family_is_invitationUnknown()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        await CreateAsync(_admin);
        var id = (await PendingAsync(_admin)).Single().GetProperty("id").GetGuid();

        await Isolation.AssertNotFoundAsync(RevokeAsync(carl.Client, id, carl.FamilyId), "invitationUnknown", "revoke");

        Assert.That(await PendingAsync(_admin), Has.Length.EqualTo(1));
    }

    [Test]
    public async Task Pending_list_shows_only_that_familys_invitations_and_a_link_joins_its_family()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        await CreateAsync(_admin);
        var (token, _) = await CreateAsync(carl.Client, carl.FamilyId);

        Assert.That((await PendingAsync(_admin)).Single().GetProperty("createdBy").GetString(), Is.EqualTo("Anna"));
        Assert.That((await PendingAsync(carl.Client, carl.FamilyId)).Single().GetProperty("createdBy").GetString(), Is.EqualTo("Carl"));

        var dora = NewClient();
        Assert.That((await dora.PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email = "dora@mail.com", displayName = "Dora", password = Password, language = "en" })).StatusCode,
            Is.EqualTo(HttpStatusCode.OK));
        var families = await dora.GetFromJsonAsync<JsonElement[]>("/api/families");
        Assert.That(families!.Single().GetProperty("id").GetGuid(), Is.EqualTo(carl.FamilyId));
    }
}
