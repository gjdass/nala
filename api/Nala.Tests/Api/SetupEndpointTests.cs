using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nala.Sql;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class SetupEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container));
        _client = _factory.Start();
    }

    [TearDown]
    public async Task TearDown()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private static object Setup(string email = "Anna@Mail.com ", string password = Password) =>
        new { email, displayName = "Anna", password, language = "fr" };

    private async Task<JsonElement> StateAsync()
    {
        var response = await _client.GetAsync("/api/auth/state");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Test]
    public async Task State_on_empty_instance_requires_setup()
    {
        var state = await StateAsync();

        Assert.That(state.GetProperty("setupRequired").GetBoolean(), Is.True);
        Assert.That(state.GetProperty("user").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Setup_creates_admin_and_signs_in()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/setup", Setup());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("nala.session="));
        Assert.That(cookie.ToLowerInvariant(), Does.Contain("httponly").And.Contain("secure").And.Contain("samesite=strict"));

        var state = await StateAsync();
        var user = state.GetProperty("user");
        Assert.That(state.GetProperty("setupRequired").GetBoolean(), Is.False);
        Assert.That(user.GetProperty("email").GetString(), Is.EqualTo("anna@mail.com"));
        Assert.That(user.GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
        Assert.That(user.GetProperty("language").GetString(), Is.EqualTo("fr"));
        Assert.That(user.GetProperty("isAdmin").GetBoolean(), Is.True);
        Assert.That(user.GetProperty("id").GetGuid(), Is.Not.EqualTo(Guid.Empty));
    }

    [Test]
    public async Task Setup_refused_once_a_user_exists()
    {
        await _client.PostAsJsonAsync("/api/auth/setup", Setup());

        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var response = await anonymous.PostAsJsonAsync("/api/auth/setup", Setup("other@mail.com"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(response.Headers.Contains("Set-Cookie"), Is.False);
        var state = await (await anonymous.GetAsync("/api/auth/state")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(state.GetProperty("setupRequired").GetBoolean(), Is.False);
        Assert.That(state.GetProperty("user").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Setup_invalid_input_returns_400_with_field_errors()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@localhost", displayName = "", password = "short", language = "en" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("email")[0].GetString(), Is.EqualTo("invalid"));
        Assert.That(errors.GetProperty("displayName")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("password")[0].GetString(), Is.EqualTo("tooShort"));
        Assert.That((await StateAsync()).GetProperty("setupRequired").GetBoolean(), Is.True);
    }

    [Test]
    public async Task Password_never_stored_or_logged()
    {
        await _client.PostAsJsonAsync("/api/auth/setup", Setup());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NalaDbContext>();
        var stored = await db.Database
            .SqlQueryRaw<string>("SELECT password_hash AS \"Value\" FROM users")
            .SingleAsync();

        Assert.That(stored, Is.Not.Empty.And.Not.Contains(Password));
        Assert.That(_factory.Logs, Is.Not.Empty);
        Assert.That(_factory.Logs, Has.None.Contains(Password));
    }

    [Test]
    public async Task Cookie_is_secure_even_over_http_outside_development()
    {
        await using var production = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container), "Production");
        using var client = production.Start(new Uri("http://localhost"));

        var response = await client.PostAsJsonAsync("/api/auth/setup", Setup());

        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("nala.session="));
        Assert.That(cookie.ToLowerInvariant(), Does.Contain("secure"));
    }

    [Test]
    public async Task Cookie_follows_the_request_scheme_in_development()
    {
        using var client = _factory.CreateClient(new() { BaseAddress = new Uri("http://localhost") });

        var response = await client.PostAsJsonAsync("/api/auth/setup", Setup());

        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("nala.session="));
        Assert.That(cookie.ToLowerInvariant(), Does.Not.Contain("secure"));
    }
}
