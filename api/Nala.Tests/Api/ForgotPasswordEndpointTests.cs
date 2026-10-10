using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Email;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class ForgotPasswordEndpointTests
{
    private const string Password = "correct horse battery";

    /// <summary>What <c>.env</c> sets for email reset, as the API sees it.</summary>
    public static readonly IReadOnlyDictionary<string, string?> SmtpSettings = new Dictionary<string, string?>
    {
        ["Nala:PublicUrl"] = "https://nala.example.com",
        ["Smtp:Host"] = "smtp.example.com",
        ["Smtp:From"] = "nala@example.com",
    };

    private NalaApiFactory _factory = null!;
    private CapturingEmailSender _sender = null!;
    private HttpClient _client = null!;

    private void Start(bool smtp)
    {
        _sender = new CapturingEmailSender();
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Settings = smtp ? SmtpSettings : new Dictionary<string, string?>(),
            ServiceOverrides = services => services.AddSingleton<IEmailSender>(_sender),
        };
        _client = _factory.Start();
    }

    [TearDown]
    public async Task TearDown()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    /// <summary>Sets the instance up with Anna, then signs out so the client is anonymous.</summary>
    private async Task SetUpAnnaAsync()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        await _client.PostAsync("/api/auth/logout", null);
    }

    private Task<HttpResponseMessage> RequestAsync(string? email) =>
        _client.PostAsJsonAsync("/api/auth/password-resets", new { email });

    private static string TokenIn(EmailMessage message)
    {
        const string prefix = "https://nala.example.com/reset/";
        var start = message.Body.IndexOf(prefix, StringComparison.Ordinal);
        Assert.That(start, Is.GreaterThanOrEqualTo(0), message.Body);
        return new string(message.Body[(start + prefix.Length)..].TakeWhile(c => !char.IsWhiteSpace(c)).ToArray());
    }

    [Test]
    public async Task Known_email_gets_202_and_an_email_whose_link_resets_the_password()
    {
        Start(smtp: true);
        await SetUpAnnaAsync();

        var response = await RequestAsync(" Anna@Mail.com ");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Accepted));
        Assert.That(await response.Content.ReadAsStringAsync(), Is.Empty);
        var message = await _sender.NextAsync();
        Assert.That(message.To, Is.EqualTo("anna@mail.com"));
        var reset = await _client.PostAsJsonAsync($"/api/auth/password-resets/{TokenIn(message)}", new { password = "battery staple" });
        Assert.That(reset.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        await _client.PostAsync("/api/auth/logout", null);
        var login = await _client.PostAsJsonAsync("/api/auth/login", new { email = "anna@mail.com", password = "battery staple" });
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Unknown_email_gets_the_same_202_and_no_email()
    {
        Start(smtp: true);
        await SetUpAnnaAsync();

        var unknown = await RequestAsync("nobody@mail.com");
        var known = await RequestAsync("anna@mail.com");

        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.Accepted));
        Assert.That(await unknown.Content.ReadAsStringAsync(), Is.EqualTo(await known.Content.ReadAsStringAsync()));
        // Emails go out in order: the first one sent is Anna's, and nothing follows.
        Assert.That((await _sender.NextAsync()).To, Is.EqualTo("anna@mail.com"));
        Assert.That(_sender.TryTake(out _), Is.False);
    }

    [Test]
    public async Task Malformed_email_is_a_validation_problem()
    {
        Start(smtp: true);
        await SetUpAnnaAsync();

        var response = await RequestAsync("anna");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("email")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task Without_smtp_the_endpoint_is_404_emailResetDisabled()
    {
        Start(smtp: false);
        await SetUpAnnaAsync();

        var response = await RequestAsync("anna@mail.com");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(
            (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString(),
            Is.EqualTo("emailResetDisabled"));
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Auth_state_reports_whether_smtp_is_enabled(bool smtp)
    {
        Start(smtp);

        var state = await _client.GetFromJsonAsync<JsonElement>("/api/auth/state");

        Assert.That(state.GetProperty("smtpEnabled").GetBoolean(), Is.EqualTo(smtp));
    }

    [Test]
    public async Task Auth_state_returned_at_sign_in_reports_smtp_too()
    {
        Start(smtp: true);

        var response = await _client.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });

        Assert.That((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("smtpEnabled").GetBoolean(), Is.True);
    }
}
