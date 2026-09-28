namespace Nala.Core.Email;

/// <summary>Delivers an email to the mail server.</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
