using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Email;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class InvitationEmailEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private CapturingEmailSender _sender = null!;
    private HttpClient _admin = null!;

    /// <summary>Anna sets the instance up and stays signed in on <see cref="_admin"/>.</summary>
    private async Task StartAsync(bool smtp)
    {
        _sender = new CapturingEmailSender();
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(DateTimeOffset.UtcNow),
            Settings = smtp ? ForgotPasswordEndpointTests.SmtpSettings : new Dictionary<string, string?>(),
            ServiceOverrides = services => services.AddSingleton<IEmailSender>(_sender),
        };
        _admin = _factory.Start();

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string? email) =>
        client.PostAsJsonAsync("/api/invitations/email", new { email });

    private static string TokenIn(EmailMessage message)
    {
        const string prefix = "https://nala.example.com/invite/";
        var start = message.Body.IndexOf(prefix, StringComparison.Ordinal);
        Assert.That(start, Is.GreaterThanOrEqualTo(0), message.Body);
        return new string(message.Body[(start + prefix.Length)..].TakeWhile(c => !char.IsWhiteSpace(c)).ToArray());
    }

    [Test]
    public async Task Email_invitation_returns_202_and_the_emailed_link_registers_a_member()
    {
        await StartAsync(smtp: true);

        var response = await SendAsync(_admin, "ben@mail.com");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Accepted));
        var expiresAt = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("expiresAt").GetDateTimeOffset();
        Assert.That(expiresAt, Is.EqualTo(_factory.Time!.GetUtcNow().AddDays(7)).Within(TimeSpan.FromSeconds(1)));
        var pending = await _admin.GetFromJsonAsync<JsonElement[]>("/api/invitations");
        Assert.That(pending!.Single().GetProperty("createdBy").GetString(), Is.EqualTo("Anna"));

        var message = await _sender.NextAsync();
        Assert.That(message.To, Is.EqualTo("ben@mail.com"));
        var register = await NewClient().PostAsJsonAsync(
            $"/api/auth/invitations/{TokenIn(message)}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(register.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Email_invitation_is_404_when_smtp_is_off()
    {
        await StartAsync(smtp: false);

        var response = await SendAsync(_admin, "ben@mail.com");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        var code = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();
        Assert.That(code, Is.EqualTo("emailInviteDisabled"));
        Assert.That(await _admin.GetFromJsonAsync<JsonElement[]>("/api/invitations"), Is.Empty);
        Assert.That(_sender.TryTake(out _), Is.False);
    }

    [TestCase("not-an-email", "invalid")]
    [TestCase(" Anna@Mail.com ", "taken")]
    public async Task Email_invitation_answers_a_validation_problem(string email, string code)
    {
        await StartAsync(smtp: true);

        var response = await SendAsync(_admin, email);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("email")[0].GetString(), Is.EqualTo(code));
        Assert.That(await _admin.GetFromJsonAsync<JsonElement[]>("/api/invitations"), Is.Empty);
    }

    [Test]
    public async Task Email_invitation_requires_a_session()
    {
        await StartAsync(smtp: true);

        var response = await SendAsync(NewClient(), "ben@mail.com");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(_sender.TryTake(out _), Is.False);
    }
}
