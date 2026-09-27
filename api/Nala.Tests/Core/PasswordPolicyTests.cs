using Nala.Core.Auth;

namespace Nala.Tests.Core;

public class PasswordPolicyTests
{
    [Test]
    public void Seven_chars_refused() => Assert.That(PasswordPolicy.IsValid("1234567"), Is.False);

    [Test]
    public void Eight_chars_accepted() => Assert.That(PasswordPolicy.IsValid("12345678"), Is.True);

    [Test]
    public void Missing_password_refused() => Assert.That(PasswordPolicy.IsValid(null), Is.False);

    [TestCase("aaaaaaaa")]
    [TestCase("        ")]
    [TestCase("ÉÉÉÉÉÉÉÉ")]
    public void No_composition_rules(string password) => Assert.That(PasswordPolicy.IsValid(password), Is.True);
}
