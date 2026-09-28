namespace Nala.Core.Email;

/// <summary>Emails waiting to be sent in the background, so the caller never waits for (or learns about) the mail server.</summary>
public interface IEmailOutbox
{
    void Enqueue(EmailMessage message);
}
