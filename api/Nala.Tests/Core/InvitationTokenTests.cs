using Nala.Core.Invitations;

namespace Nala.Tests.Core;

public class InvitationTokenTests
{
    [Test]
    public void Generated_tokens_are_unique_url_safe_and_long()
    {
        var tokens = Enumerable.Range(0, 100).Select(_ => InvitationToken.Generate()).ToList();

        Assert.That(tokens, Is.Unique);
        Assert.That(tokens, Has.All.Length.AtLeast(43));
        Assert.That(tokens, Has.All.Match("^[A-Za-z0-9_-]+$"));
    }

    [Test]
    public void Hash_is_deterministic_and_differs_from_the_token()
    {
        var token = InvitationToken.Generate();
        var hash = InvitationToken.Hash(token);

        Assert.That(InvitationToken.Hash(token), Is.EqualTo(hash));
        Assert.That(hash, Is.Not.EqualTo(token));
        Assert.That(hash, Is.Not.EqualTo(InvitationToken.Hash(InvitationToken.Generate())));
    }
}
