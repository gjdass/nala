using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class FamilyEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public async Task SetUp()
    {
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container));
        _client = _factory.Start();
        var response = await _client.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [TearDown]
    public async Task TearDown()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    [Test]
    public async Task Families_need_a_session()
    {
        using var anonymous = NewClient();

        var response = await anonymous.GetAsync("/api/families");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    /// <summary>Ben, invited into the Martins family, signed in on a new client.</summary>
    private async Task<HttpClient> InviteBenAsync()
    {
        var link = await (await _client.PostAsync("/api/invitations", null)).Content.ReadFromJsonAsync<JsonElement>();
        var ben = NewClient();
        var registered = await ben.PostAsJsonAsync(
            $"/api/auth/invitations/{link.GetProperty("token").GetString()}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(registered.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return ben;
    }

    private async Task<Guid> MartinsIdAsync() =>
        (await (await _client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>())[0].GetProperty("id").GetGuid();

    [Test]
    public async Task An_invited_member_sees_the_family_as_member()
    {
        using var ben = await InviteBenAsync();

        var families = await (await ben.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.That(families.GetArrayLength(), Is.EqualTo(1));
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("Martins"));
        Assert.That(families[0].GetProperty("isAdmin").GetBoolean(), Is.False);
    }

    [Test]
    public async Task The_family_admin_renames_the_family()
    {
        var id = await MartinsIdAsync();

        var response = await _client.PatchAsJsonAsync($"/api/families/{id}", new { name = " The Martins " });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(body.GetProperty("name").GetString(), Is.EqualTo("The Martins"));
        Assert.That(body.GetProperty("isAdmin").GetBoolean(), Is.True);
        var families = await (await _client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("The Martins"));
    }

    [Test]
    public async Task A_member_cannot_rename_the_family()
    {
        var id = await MartinsIdAsync();
        using var ben = await InviteBenAsync();

        var response = await ben.PatchAsJsonAsync($"/api/families/{id}", new { name = "Ben's" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo("familyAdminOnly"));
        var families = await (await _client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("Martins"));
    }

    [Test]
    public async Task Another_familys_or_an_unknown_family_is_not_found()
    {
        using var other = await OtherFamily.CreateAsync(_factory);

        await Isolation.AssertNotFoundAsync(
            _client.PatchAsJsonAsync($"/api/families/{other.FamilyId}", new { name = "Mine" }), "familyNotFound", "other family");
        await Isolation.AssertNotFoundAsync(
            _client.PatchAsJsonAsync($"/api/families/{Guid.NewGuid()}", new { name = "Mine" }), "familyNotFound", "unknown family");
        var families = await (await other.Client.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("Others"));
    }

    [Test]
    public async Task An_invalid_name_is_a_validation_problem()
    {
        var id = await MartinsIdAsync();

        var response = await _client.PatchAsJsonAsync($"/api/families/{id}", new { name = new string('a', 51) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("errors").GetProperty("name")[0].GetString(), Is.EqualTo("tooLong"));
    }

    [Test]
    public async Task Renaming_needs_a_session()
    {
        var id = await MartinsIdAsync();
        using var anonymous = NewClient();

        var response = await anonymous.PatchAsJsonAsync($"/api/families/{id}", new { name = "Mine" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
