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

    [Test]
    public async Task An_invited_member_sees_the_family_as_member()
    {
        var link = await (await _client.PostAsync("/api/invitations", null)).Content.ReadFromJsonAsync<JsonElement>();
        using var ben = NewClient();
        var registered = await ben.PostAsJsonAsync(
            $"/api/auth/invitations/{link.GetProperty("token").GetString()}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(registered.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        var families = await (await ben.GetAsync("/api/families")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.That(families.GetArrayLength(), Is.EqualTo(1));
        Assert.That(families[0].GetProperty("name").GetString(), Is.EqualTo("Martins"));
        Assert.That(families[0].GetProperty("isAdmin").GetBoolean(), Is.False);
    }
}
