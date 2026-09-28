using Nala.Core.Email;

namespace Nala.Api.Email;

public static class EmailServiceCollectionExtensions
{
    /// <summary>Reads the email settings (failing fast when they are wrong) and sends queued emails in the background.</summary>
    public static IServiceCollection AddNalaEmail(this IServiceCollection services, IConfiguration configuration)
    {
        var options = EmailOptions.Load(configuration);
        services.AddSingleton(options);
        services.AddSingleton<EmailQueue>();
        services.AddSingleton<IEmailOutbox>(provider => provider.GetRequiredService<EmailQueue>());
        services.AddSingleton<IEmailSender, SmtpEmailSender>();
        services.AddHostedService<EmailDispatcher>();
        return services;
    }
}
