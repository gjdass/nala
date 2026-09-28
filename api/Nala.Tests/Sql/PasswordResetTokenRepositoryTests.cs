using Nala.Core.Auth;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Auth;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class PasswordResetTokenRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
    private User _anna = null!;
    private User _ben = null!;

    [SetUp]
    public async Task SetUp()
    {
        _db = await TestDatabase.CreateAsync();
        _anna = NewUser("anna@mail.com");
        _ben = NewUser("ben@mail.com");
        await using var db = _db();
        var users = new UserRepository(db);
        await users.AddAsync(_anna);
        await users.AddAsync(_ben);
    }

    private static User NewUser(string email) => new()
    {
        Id = Guid.NewGuid(),
        Email = email,
        DisplayName = email.Split('@')[0],
        PasswordHash = "hash",
        PreferredLanguage = "en",
        CreatedAt = Now,
    };

    private static PasswordResetToken NewToken(User user, Action<PasswordResetToken>? change = null)
    {
        var token = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(LinkToken.Generate()),
            UserId = user.Id,
            CreatedAt = Now,
            ExpiresAt = Now + PasswordResetPolicy.AdminLinkLifetime,
        };
        change?.Invoke(token);
        return token;
    }

    private async Task<PasswordResetToken> ReplaceAsync(PasswordResetToken token)
    {
        await using var db = _db();
        await new PasswordResetTokenRepository(db).ReplaceAsync(token);
        return token;
    }

    private async Task<PasswordResetToken?> ReadAsync(PasswordResetToken token)
    {
        await using var db = _db();
        return await new PasswordResetTokenRepository(db).GetByTokenHashAsync(token.TokenHash);
    }

    private async Task<bool> ConsumeAsync(PasswordResetToken token, DateTimeOffset now)
    {
        await using var db = _db();
        return await new PasswordResetTokenRepository(db).ConsumeAsync(token.Id, now);
    }

    [Test]
    public async Task Added_token_is_read_back_by_its_hash()
    {
        var token = await ReplaceAsync(NewToken(_ben));

        var read = await ReadAsync(token);

        Assert.That(read, Is.Not.Null);
        Assert.That(read!.Id, Is.EqualTo(token.Id));
        Assert.That(read.UserId, Is.EqualTo(_ben.Id));
        Assert.That(read.CreatedAt, Is.EqualTo(Now));
        Assert.That(read.ExpiresAt, Is.EqualTo(token.ExpiresAt));
        Assert.That(read.UsedAt, Is.Null);
    }

    [Test]
    public async Task Replace_removes_only_the_same_users_unused_tokens()
    {
        var used = await ReplaceAsync(NewToken(_ben, t => t.UsedAt = Now));
        var unused = await ReplaceAsync(NewToken(_ben));
        var annas = await ReplaceAsync(NewToken(_anna));

        var newest = await ReplaceAsync(NewToken(_ben));

        Assert.That(await ReadAsync(unused), Is.Null);
        Assert.That(await ReadAsync(used), Is.Not.Null);
        Assert.That(await ReadAsync(annas), Is.Not.Null);
        Assert.That(await ReadAsync(newest), Is.Not.Null);
    }

    [Test]
    public async Task Consume_succeeds_once()
    {
        var token = await ReplaceAsync(NewToken(_ben));

        Assert.That(await ConsumeAsync(token, Now), Is.True);
        Assert.That(await ConsumeAsync(token, Now), Is.False);
        Assert.That((await ReadAsync(token))!.UsedAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Consume_fails_from_the_expiry()
    {
        var token = await ReplaceAsync(NewToken(_ben));

        Assert.That(await ConsumeAsync(token, token.ExpiresAt), Is.False);
        Assert.That((await ReadAsync(token))!.UsedAt, Is.Null);
    }
}
