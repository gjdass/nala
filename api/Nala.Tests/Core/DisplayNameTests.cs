using Nala.Core.Auth;

namespace Nala.Tests.Core;

public class DisplayNameTests
{
    [Test]
    public void Trimmed()
    {
        Assert.That(DisplayName.TryNormalize("  Anna ", out var name), Is.True);
        Assert.That(name, Is.EqualTo("Anna"));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public void Empty_refused(string? input) => Assert.That(DisplayName.TryNormalize(input, out _), Is.False);

    [Test]
    public void Fifty_chars_accepted_fifty_one_refused()
    {
        Assert.That(DisplayName.TryNormalize(new string('a', 50), out _), Is.True);
        Assert.That(DisplayName.TryNormalize(new string('a', 51), out _), Is.False);
    }
}
