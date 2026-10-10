using Nala.Core.Families;

namespace Nala.Tests.Core;

public class FamilyNameTests
{
    [Test]
    public void Trims_a_valid_name()
    {
        Assert.That(FamilyName.Validate("  The Martins ", out var name), Is.Null);
        Assert.That(name, Is.EqualTo("The Martins"));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public void Blank_is_required(string? input) =>
        Assert.That(FamilyName.Validate(input, out _), Is.EqualTo("required"));

    [Test]
    public void Fifty_characters_are_allowed_after_trimming() =>
        Assert.That(FamilyName.Validate($" {new string('a', 50)} ", out _), Is.Null);

    [Test]
    public void Fifty_one_characters_are_too_long() =>
        Assert.That(FamilyName.Validate(new string('a', 51), out _), Is.EqualTo("tooLong"));
}
