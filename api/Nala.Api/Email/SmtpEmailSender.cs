using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Nala.Core.Email;

namespace Nala.Api.Email;

/// <summary>Sends plain-text emails through the configured SMTP server, one connection per email (they are rare).</summary>
public sealed class SmtpEmailSender(EmailOptions options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var mime = new MimeMessage
        {
            Subject = message.Subject,
            Body = new TextPart("plain") { Text = message.Body },
        };
        mime.From.Add(MailboxAddress.Parse(options.From));
        mime.To.Add(MailboxAddress.Parse(message.To));

        using var client = new SmtpClient();
        await client.ConnectAsync(options.Host, options.Port, SocketOptions(options.Security), cancellationToken);
        if (options.Username is not null)
        {
            await client.AuthenticateAsync(options.Username, options.Password ?? string.Empty, cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private static SecureSocketOptions SocketOptions(string security) => security switch
    {
        "starttls" => SecureSocketOptions.StartTls,
        "ssl" => SecureSocketOptions.SslOnConnect,
        "none" => SecureSocketOptions.None,
        _ => SecureSocketOptions.Auto,
    };
}
