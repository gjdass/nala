using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Sql;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class LoginEndpointTests
{
    private const string Password = "correct horse battery";

    private FixedTimeProvider _time = null!;
    private NalaApiFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _time = new FixedTimeProvider(DateTimeOffset.UtcNow);
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container)) { Time = _time };
        _client = _factory.Start();

        // The admin, then a fresh client with no session.
        using var setup = NewClient();
        var response = await setup.PostAsJsonAsync(
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

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email = "Anna@Mail.com ", string password = Password) =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password });

    private static async Task<JsonElement> UserAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/auth/state");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user");
    }

    private static string SessionCookie(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("nala.session="));

    private async Task<int> SessionCountAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NalaDbContext>();
        return await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM sessions").SingleAsync();
    }

    [Test]
    public async Task Login_sets_a_secure_httponly_samesite_cookie_and_returns_the_user()
    {
        var response = await LoginAsync(_client);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var cookie = SessionCookie(response).ToLowerInvariant();
        Assert.That(cookie, Does.Contain("httponly").And.Contain("secure").And.Contain("samesite=strict").And.Contain("expires="));

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.EnumerateObject().Select(p => p.Name), Is.EquivalentTo(new[] { "setupRequired", "user", "smtpEnabled" }));
        Assert.That(body.GetProperty("user").GetProperty("email").GetString(), Is.EqualTo("anna@mail.com"));
        Assert.That((await UserAsync(_client)).GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
    }

    [Test]
    public async Task Wrong_password_and_unknown_email_return_the_same_401()
    {
        var wrongPassword = await LoginAsync(_client, password: "wrong password");
        var unknownEmail = await LoginAsync(_client, email: "nobody@mail.com");

        Assert.That(wrongPassword.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(unknownEmail.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        var body = await wrongPassword.Content.ReadAsStringAsync();
        Assert.That(body, Is.EqualTo(await unknownEmail.Content.ReadAsStringAsync()));
        Assert.That(JsonDocument.Parse(body).RootElement.GetProperty("code").GetString(), Is.EqualTo("invalidCredentials"));
        Assert.That(wrongPassword.Headers.Contains("Set-Cookie"), Is.False);
    }

    [Test]
    public async Task Missing_fields_return_400_with_field_errors()
    {
        var response = await LoginAsync(_client, email: "", password: "");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("email")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("password")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task Sixth_attempt_after_five_failures_is_refused_with_429()
    {
        for (var i = 0; i < LoginThrottle.MaxFailures; i++)
        {
            await LoginAsync(_client, password: "wrong password");
        }

        var locked = await LoginAsync(_client);

        Assert.That(locked.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests));
        Assert.That((await locked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString(), Is.EqualTo("tooManyAttempts"));

        _time.Now += LoginThrottle.Window;
        Assert.That((await LoginAsync(_client)).StatusCode, Is.EqualTo(HttpStatusCode.OK), "the lock is temporary");
    }

    [Test]
    public async Task Session_rolls_on_use_and_expires_after_90_days_idle()
    {
        await LoginAsync(_client);

        _time.Now += TimeSpan.FromDays(89);
        Assert.That((await UserAsync(_client)).ValueKind, Is.EqualTo(JsonValueKind.Object), "used after 89 days");
        _time.Now += TimeSpan.FromDays(89);
        Assert.That((await UserAsync(_client)).ValueKind, Is.EqualTo(JsonValueKind.Object), "used 89 days later again");

        _time.Now += SessionPolicy.IdleTimeout;
        Assert.That((await UserAsync(_client)).ValueKind, Is.EqualTo(JsonValueKind.Null), "90 days without use");
        Assert.That((await _client.PostAsync("/api/auth/logout", null)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Use_renews_the_cookie_expiry()
    {
        await LoginAsync(_client);
        _time.Now += TimeSpan.FromDays(60);

        var response = await _client.GetAsync("/api/auth/state");

        var expires = SessionCookie(response).Split(';').Select(p => p.Trim())
            .Single(p => p.StartsWith("expires=", StringComparison.OrdinalIgnoreCase))["expires=".Length..];
        Assert.That(DateTimeOffset.Parse(expires), Is.EqualTo(_time.Now + SessionPolicy.IdleTimeout).Within(TimeSpan.FromMinutes(1)));
    }

    [Test]
    public async Task Logout_ends_only_the_current_session()
    {
        using var phone = NewClient();
        using var tablet = NewClient();
        var phoneCookie = SessionCookie(await LoginAsync(phone)).Split(';')[0];
        await LoginAsync(tablet);

        var logout = await phone.PostAsync("/api/auth/logout", null);

        Assert.That(logout.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That((await UserAsync(phone)).ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That((await UserAsync(tablet)).ValueKind, Is.EqualTo(JsonValueKind.Object), "other sessions keep working");

        // The old cookie replayed from elsewhere is dead server-side, not just deleted in the browser.
        using var replay = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false });
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        request.Headers.Add("Cookie", phoneCookie);
        Assert.That((await replay.SendAsync(request)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Logout_without_a_session_returns_401()
    {
        var response = await _client.PostAsync("/api/auth/logout", null);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task Setup_and_login_each_start_a_server_side_session()
    {
        Assert.That(await SessionCountAsync(), Is.EqualTo(1), "setup");

        await LoginAsync(_client);

        Assert.That(await SessionCountAsync(), Is.EqualTo(2));
    }
}
