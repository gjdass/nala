using MimeKit;

namespace Nala.Api.Email;

/// <summary>
/// Where "Forgot password" emails go out from. Email reset is on only when an SMTP host is set; then the sender and
/// the public URL (for the links) are required. Every value comes from the environment (see <c>.env.example</c>).
/// </summary>
public sealed class EmailOptions
{
    public static readonly IReadOnlyList<string> SecurityModes = ["auto", "starttls", "ssl", "none"];

    public bool Enabled { get; init; }

    /// <summary>The address the app is reached at, e.g. <c>https://nala.example.com</c>; reset links start with it.</summary>
    public Uri? PublicUrl { get; init; }

    public string Host { get; init; } = string.Empty;

    public int Port { get; init; } = 587;

    public string? Username { get; init; }

    public string? Password { get; init; }

    public string From { get; init; } = string.Empty;

    /// <summary>One of <see cref="SecurityModes"/>: <c>auto</c> picks TLS from the port and the server's offer.</summary>
    public string Security { get; init; } = "auto";

    /// <summary>Reads and checks the settings; a misconfiguration stops the API at startup, naming the variable to fix.</summary>
    public static EmailOptions Load(IConfiguration configuration)
    {
        var smtp = configuration.GetSection("Smtp");
        var host = smtp["Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            return new EmailOptions();
        }

        var from = smtp["From"];
        if (string.IsNullOrWhiteSpace(from) || !MailboxAddress.TryParse(from, out var mailbox) || !mailbox.Address.Contains('@'))
        {
            throw Misconfigured("SMTP_FROM", "must be the sender's email address when SMTP_HOST is set");
        }

        var publicUrl = configuration["Nala:PublicUrl"];
        if (!Uri.TryCreate(publicUrl, UriKind.Absolute, out var url) || (url.Scheme != Uri.UriSchemeHttps && url.Scheme != Uri.UriSchemeHttp))
        {
            throw Misconfigured("NALA_PUBLIC_URL", "must be the app's address (e.g. https://nala.example.com) when SMTP_HOST is set");
        }

        var port = smtp["Port"];
        var portNumber = 587;
        if (!string.IsNullOrWhiteSpace(port) && (!int.TryParse(port, out portNumber) || portNumber is < 1 or > 65535))
        {
            throw Misconfigured("SMTP_PORT", "must be a port number");
        }

        var security = string.IsNullOrWhiteSpace(smtp["Security"]) ? "auto" : smtp["Security"]!.Trim().ToLowerInvariant();
        if (!SecurityModes.Contains(security))
        {
            throw Misconfigured("SMTP_SECURITY", $"must be one of {string.Join(", ", SecurityModes)}");
        }

        return new EmailOptions
        {
            Enabled = true,
            PublicUrl = url,
            Host = host.Trim(),
            Port = portNumber,
            Username = string.IsNullOrEmpty(smtp["Username"]) ? null : smtp["Username"],
            Password = string.IsNullOrEmpty(smtp["Password"]) ? null : smtp["Password"],
            From = from.Trim(),
            Security = security,
        };
    }

    private static InvalidOperationException Misconfigured(string variable, string rule) =>
        new($"Invalid email settings: {variable} {rule}.");
}
