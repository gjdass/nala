using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Tests.Core;

public class PasswordResetEmailTests
{
    private static User Ben(string language) => new()
    {
        Id = Guid.NewGuid(),
        Email = "ben@mail.com",
        DisplayName = "Ben",
        PasswordHash = "hash",
        PreferredLanguage = language,
    };

    [Test]
    public void English_email_greets_the_user_and_carries_the_link_valid_1_hour()
    {
        var message = PasswordResetEmail.Compose(Ben("en"), new Uri("https://nala.example.com"), "abc");

        Assert.That(message.To, Is.EqualTo("ben@mail.com"));
        Assert.That(message.Subject, Is.EqualTo("Reset your Nala password"));
        Assert.That(message.Body, Does.Contain("Hello Ben,"));
        Assert.That(message.Body, Does.Contain("https://nala.example.com/reset/abc"));
        Assert.That(message.Body, Does.Contain("1 hour"));
    }

    [Test]
    public void French_email_is_in_french()
    {
        var message = PasswordResetEmail.Compose(Ben("fr"), new Uri("https://nala.example.com"), "abc");

        Assert.That(message.Subject, Is.EqualTo("Réinitialiser votre mot de passe Nala"));
        Assert.That(message.Body, Does.Contain("Bonjour Ben,"));
        Assert.That(message.Body, Does.Contain("https://nala.example.com/reset/abc"));
        Assert.That(message.Body, Does.Contain("1 heure"));
    }

    [Test]
    public void Unknown_language_falls_back_to_english() =>
        Assert.That(
            PasswordResetEmail.Compose(Ben("de"), new Uri("https://nala.example.com"), "abc").Subject,
            Is.EqualTo("Reset your Nala password"));

    [TestCase("https://nala.example.com", "https://nala.example.com/reset/abc")]
    [TestCase("https://nala.example.com/", "https://nala.example.com/reset/abc")]
    [TestCase("https://example.com/nala/", "https://example.com/nala/reset/abc")]
    public void Link_joins_the_public_url_and_the_token_with_one_slash(string publicUrl, string link) =>
        Assert.That(PasswordResetEmail.Compose(Ben("en"), new Uri(publicUrl), "abc").Body, Does.Contain(link + "\n"));
}
