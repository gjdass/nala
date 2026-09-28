using System.Net;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

/// <summary>Email reset is off without an SMTP host; with one, a sender and the public URL are required at startup.</summary>
public class EmailConfigurationTests
{
    private static NalaApiFactory Factory(Dictionary<string, string?> settings) =>
        new(PostgresContainer.FreshDatabase(SharedPostgres.Container)) { Settings = settings };

    private static Dictionary<string, string?> Smtp(string key, string? value) =>
        new(ForgotPasswordEndpointTests.SmtpSettings) { [key] = value };

    [Test]
    public async Task Starts_without_any_smtp_setting()
    {
        await using var factory = Factory([]);

        var response = await factory.Start().GetAsync("/api/health");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Starts_with_empty_smtp_settings_as_compose_passes_them()
    {
        await using var factory = Factory(new()
        {
            ["Nala:PublicUrl"] = "",
            ["Smtp:Host"] = "",
            ["Smtp:Port"] = "587",
            ["Smtp:Username"] = "",
            ["Smtp:Password"] = "",
            ["Smtp:From"] = "",
            ["Smtp:Security"] = "",
        });

        var response = await factory.Start().GetAsync("/api/health");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [TestCase("Smtp:From", null, "SMTP_FROM")]
    [TestCase("Smtp:From", "not an address", "SMTP_FROM")]
    [TestCase("Nala:PublicUrl", null, "NALA_PUBLIC_URL")]
    [TestCase("Nala:PublicUrl", "nala.example.com", "NALA_PUBLIC_URL")]
    [TestCase("Smtp:Port", "smtp", "SMTP_PORT")]
    [TestCase("Smtp:Security", "tls", "SMTP_SECURITY")]
    public async Task Startup_fails_naming_the_variable_when_smtp_is_misconfigured(string key, string? value, string variable)
    {
        await using var factory = Factory(Smtp(key, value));

        var error = Assert.Catch(() => factory.Start());

        Assert.That(Flatten(error).Select(e => e.Message), Has.Some.Contains(variable));
    }

    private static IEnumerable<Exception> Flatten(Exception? e)
    {
        for (; e is not null; e = e.InnerException)
        {
            yield return e;
        }
    }
}
