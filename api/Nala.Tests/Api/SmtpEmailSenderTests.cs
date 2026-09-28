using System.Net.Http.Json;
using System.Text.Json;
using DotNet.Testcontainers.Containers;
using Nala.Api.Email;
using Nala.Core.Email;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

/// <summary>The MailKit sender against a real SMTP server (Mailpit).</summary>
public class SmtpEmailSenderTests
{
    private IContainer _mailpit = null!;
    private HttpClient _mailbox = null!;

    [OneTimeSetUp]
    public async Task StartAsync()
    {
        _mailpit = await MailpitContainer.StartAsync();
        _mailbox = new HttpClient
        {
            BaseAddress = new Uri($"http://{_mailpit.Hostname}:{_mailpit.GetMappedPublicPort(MailpitContainer.HttpPort)}"),
        };
    }

    [OneTimeTearDown]
    public async Task StopAsync()
    {
        _mailbox.Dispose();
        await _mailpit.DisposeAsync();
    }

    [Test]
    public async Task Sends_a_plain_text_email_through_the_smtp_server()
    {
        var sender = new SmtpEmailSender(new EmailOptions
        {
            Enabled = true,
            PublicUrl = new Uri("https://nala.example.com"),
            Host = _mailpit.Hostname,
            Port = _mailpit.GetMappedPublicPort(MailpitContainer.SmtpPort),
            From = "nala@example.com",
            Security = "none",
        });

        await sender.SendAsync(new EmailMessage("ben@mail.com", "Réinitialiser votre mot de passe Nala", "Bonjour Ben,\n\nhttps://nala.example.com/reset/abc\n"));

        var list = await _mailbox.GetFromJsonAsync<JsonElement>("/api/v1/messages");
        var summary = list.GetProperty("messages").EnumerateArray().Single();
        Assert.That(summary.GetProperty("From").GetProperty("Address").GetString(), Is.EqualTo("nala@example.com"));
        Assert.That(summary.GetProperty("To")[0].GetProperty("Address").GetString(), Is.EqualTo("ben@mail.com"));
        Assert.That(summary.GetProperty("Subject").GetString(), Is.EqualTo("Réinitialiser votre mot de passe Nala"));
        var message = await _mailbox.GetFromJsonAsync<JsonElement>($"/api/v1/message/{summary.GetProperty("ID").GetString()}");
        Assert.That(message.GetProperty("Text").GetString(), Does.Contain("https://nala.example.com/reset/abc"));
        Assert.That(message.GetProperty("HTML").GetString(), Is.Empty);
    }
}
