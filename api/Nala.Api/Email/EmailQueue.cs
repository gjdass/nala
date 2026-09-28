using System.Threading.Channels;
using Nala.Core.Email;

namespace Nala.Api.Email;

/// <summary>In-memory outbox read by <see cref="EmailDispatcher"/>. Emails still queued when the API stops are lost.</summary>
public sealed class EmailQueue : IEmailOutbox
{
    private readonly Channel<EmailMessage> _messages = Channel.CreateUnbounded<EmailMessage>(new() { SingleReader = true });

    public ChannelReader<EmailMessage> Reader => _messages.Reader;

    public void Enqueue(EmailMessage message) => _messages.Writer.TryWrite(message);
}
