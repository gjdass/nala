using Nala.Core.Auth;

namespace Nala.Tests.Core;

public class EmailAddressTests
{
    [Test]
    public void Normalize_trims_and_lowercases()
    {
        Assert.That(EmailAddress.TryNormalize("Anna@Mail.com ", out var email), Is.True);
        Assert.That(email, Is.EqualTo("anna@mail.com"));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    [TestCase("anna")]
    [TestCase("@mail.com")]
    [TestCase("anna@")]
    [TestCase("anna@localhost")]
    [TestCase("a@b@c.com")]
    [TestCase("an na@mail.com")]
    public void Rejects_invalid(string? input)
    {
        Assert.That(EmailAddress.TryNormalize(input, out _), Is.False);
    }

    [Test]
    public void Rejects_more_than_254_characters()
    {
        var local = new string('a', 64);
        var tooLong = $"{local}@{new string('b', 255 - local.Length - 5)}.com";

        Assert.That(tooLong, Has.Length.EqualTo(255));
        Assert.That(EmailAddress.TryNormalize(tooLong, out _), Is.False);
        Assert.That(EmailAddress.TryNormalize(tooLong[1..], out _), Is.True);
    }
}
