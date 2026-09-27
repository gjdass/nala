using Nala.Core.Auth;

namespace Nala.Tests.Core;

public class AccountFieldsTests
{
    [Test]
    public void Valid_fields_have_no_errors() =>
        Assert.That(AccountFields.Validate("Anna@Mail.com ", " Anna ", "correct horse"), Is.Empty);

    [Test]
    public void Missing_fields_are_required() =>
        Assert.That(AccountFields.Validate(" ", null, ""), Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "required",
            ["displayName"] = "required",
            ["password"] = "required",
        }));

    [Test]
    public void Invalid_fields_return_their_codes() =>
        Assert.That(AccountFields.Validate("anna@localhost", new string('a', 51), "short"), Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "invalid",
            ["displayName"] = "tooLong",
            ["password"] = "tooShort",
        }));
}
