using Nala.Core.Email;

namespace Nala.Tests.Support;

public class FakeEmailOutbox : IEmailOutbox
{
    public List<EmailMessage> Messages { get; } = [];

    public void Enqueue(EmailMessage message) => Messages.Add(message);
}
