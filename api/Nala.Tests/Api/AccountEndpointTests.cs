using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class AccountEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _client = null!;

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
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
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

        Assert.That(patch.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(password.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
