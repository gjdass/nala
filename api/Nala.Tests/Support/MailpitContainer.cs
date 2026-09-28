using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace Nala.Tests.Support;

/// <summary>A real SMTP server that keeps what it receives and shows it through an HTTP API.</summary>
public static class MailpitContainer
{
    public const string Image = "axllent/mailpit:v1.31";

    public const int SmtpPort = 1025;

    public const int HttpPort = 8025;

    public static async Task<IContainer> StartAsync()
    {
        var container = new ContainerBuilder(Image)
            .WithPortBinding(SmtpPort, true)
            .WithPortBinding(HttpPort, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(HttpPort).ForPath("/livez")))
            .Build();
        await container.StartAsync();
        return container;
    }
}
