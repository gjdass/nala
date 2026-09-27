using Nala.Api.Auth;

namespace Nala.Tests.Api;

public class IdentityPasswordHasherTests
{
    private readonly IdentityPasswordHasher _hasher = new();

    [Test]
    public void Hash_is_not_the_password_and_is_salted()
    {
        var first = _hasher.Hash("correct horse");
        var second = _hasher.Hash("correct horse");

        Assert.That(first, Does.Not.Contain("correct horse"));
        Assert.That(first, Is.Not.EqualTo(second));
    }

    [Test]
    public void Verify_accepts_the_right_password_only()
    {
        var hash = _hasher.Hash("correct horse");

        Assert.That(_hasher.Verify(hash, "correct horse"), Is.True);
        Assert.That(_hasher.Verify(hash, "wrong horse"), Is.False);
    }
}
