using System.Threading.Channels;
using Nala.Core.Email;

namespace Nala.Tests.Support;

/// <summary>Stands in for the SMTP server: keeps every email "sent", in order.</summary>
public class CapturingEmailSender : IEmailSender
{
    private readonly Channel<EmailMessage> _sent = Channel.CreateUnbounded<EmailMessage>();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default) =>
        _sent.Writer.WriteAsync(message, cancellationToken).AsTask();

    /// <summary>The next email sent, waiting for the background sender; fails after a few seconds.</summary>
    public async Task<EmailMessage> NextAsync()
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        return await _sent.Reader.ReadAsync(timeout.Token);
    }

    public bool TryTake(out EmailMessage? message) => _sent.Reader.TryRead(out message);
}
