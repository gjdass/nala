using Nala.Core.Email;

namespace Nala.Api.Email;

/// <summary>Sends queued emails one by one. A failure is logged (never the body: it may hold a link) and never retried.</summary>
public sealed partial class EmailDispatcher(EmailQueue queue, IEmailSender sender, ILogger<EmailDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await sender.SendAsync(message, stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
            {
                LogSendFailed(e, message.Subject);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Could not send the email \"{Subject}\".")]
    private partial void LogSendFailed(Exception exception, string subject);
}
