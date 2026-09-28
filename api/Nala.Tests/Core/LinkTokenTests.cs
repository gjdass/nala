using Nala.Core.Auth;

namespace Nala.Tests.Core;

public class LinkTokenTests
{
    [Test]
    public void Generated_tokens_are_unique_url_safe_and_long()
    {
        var tokens = Enumerable.Range(0, 100).Select(_ => LinkToken.Generate()).ToList();

        Assert.That(tokens, Is.Unique);
        Assert.That(tokens, Has.All.Length.AtLeast(43));
        Assert.That(tokens, Has.All.Match("^[A-Za-z0-9_-]+$"));
    }

    [Test]
    public void Hash_is_deterministic_and_differs_from_the_token()
    {
        var token = LinkToken.Generate();
        var hash = LinkToken.Hash(token);

        Assert.That(LinkToken.Hash(token), Is.EqualTo(hash));
        Assert.That(hash, Is.Not.EqualTo(token));
        Assert.That(hash, Is.Not.EqualTo(LinkToken.Hash(LinkToken.Generate())));
    }
}
