using Microsoft.EntityFrameworkCore;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Invitations;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class InvitationRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
    private User _anna = null!;

    [SetUp]
    public async Task SetUp()
    {
        _db = await TestDatabase.CreateAsync();
        _anna = NewUser("anna@mail.com");
        await using var db = _db();
        await new UserRepository(db).AddAsync(_anna);
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

    private async Task<Invitation> InviteAsync(Action<Invitation>? change = null)
    {
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = InvitationToken.Hash(InvitationToken.Generate()),
            CreatedByUserId = _anna.Id,
            CreatedAt = Now,
            ExpiresAt = Now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        await using var db = _db();
        await new InvitationRepository(db).AddAsync(invitation);
        return invitation;
    }

    private async Task<bool> RedeemAsync(Invitation invitation, User user, DateTimeOffset? now = null)
    {
        await using var db = _db();
        return await new InvitationRepository(db).RedeemAsync(invitation.Id, user, now ?? Now);
    }

    private async Task<Invitation> ReadAsync(Invitation invitation)
    {
        await using var db = _db();
        return (await new InvitationRepository(db).GetByTokenHashAsync(invitation.TokenHash))!;
    }

    private async Task<User?> UserAsync(Guid id)
    {
        await using var db = _db();
        return await new UserRepository(db).GetByIdAsync(id);
    }

    [Test]
    public async Task Added_invitation_is_read_back_by_token_hash()
    {
        var invitation = await InviteAsync(i => i.RevokedAt = Now);

        var read = await ReadAsync(invitation);

        Assert.That(read.Id, Is.EqualTo(invitation.Id));
        Assert.That(read.CreatedByUserId, Is.EqualTo(_anna.Id));
        Assert.That(read.CreatedAt, Is.EqualTo(Now));
        Assert.That(read.ExpiresAt, Is.EqualTo(invitation.ExpiresAt));
        Assert.That(read.RevokedAt, Is.EqualTo(Now));
        Assert.That(read.UsedAt, Is.Null);
        Assert.That(read.UsedByUserId, Is.Null);
    }

    [Test]
    public async Task Unknown_token_hash_reads_null()
    {
        await using var db = _db();
        Assert.That(await new InvitationRepository(db).GetByTokenHashAsync("unknown"), Is.Null);
    }

    [Test]
    public async Task Redeem_inserts_the_user_and_marks_the_invitation_used()
    {
        var invitation = await InviteAsync();
        var ben = NewUser("ben@mail.com");

        Assert.That(await RedeemAsync(invitation, ben, Now.AddHours(1)), Is.True);

        Assert.That(await UserAsync(ben.Id), Is.Not.Null);
        var read = await ReadAsync(invitation);
        Assert.That(read.UsedAt, Is.EqualTo(Now.AddHours(1)));
        Assert.That(read.UsedByUserId, Is.EqualTo(ben.Id));
    }

    [Test]
    public async Task Redeem_of_a_used_invitation_inserts_nothing()
    {
        var invitation = await InviteAsync();
        await RedeemAsync(invitation, NewUser("ben@mail.com"));
        var carl = NewUser("carl@mail.com");

        Assert.That(await RedeemAsync(invitation, carl), Is.False);
        Assert.That(await UserAsync(carl.Id), Is.Null);
    }

    [Test]
    public async Task Redeem_of_a_revoked_invitation_inserts_nothing()
    {
        var invitation = await InviteAsync(i => i.RevokedAt = Now);
        var ben = NewUser("ben@mail.com");

        Assert.That(await RedeemAsync(invitation, ben), Is.False);
        Assert.That(await UserAsync(ben.Id), Is.Null);
    }

    [Test]
    public async Task Redeem_of_an_expired_invitation_inserts_nothing()
    {
        var invitation = await InviteAsync();
        var ben = NewUser("ben@mail.com");

        Assert.That(await RedeemAsync(invitation, ben, invitation.ExpiresAt), Is.False);
        Assert.That(await UserAsync(ben.Id), Is.Null);
    }

    [Test]
    public async Task Redeem_with_a_taken_email_throws_and_leaves_the_invitation_unused()
    {
        var invitation = await InviteAsync();

        Assert.That(() => RedeemAsync(invitation, NewUser("anna@mail.com")), Throws.InstanceOf<UserConflictException>());
        Assert.That((await ReadAsync(invitation)).UsedAt, Is.Null);
    }

    [Test]
    public async Task Concurrent_redeems_create_a_single_user()
    {
        var invitation = await InviteAsync();

        var results = await Task.WhenAll(
            Enumerable.Range(0, 5).Select(n => RedeemAsync(invitation, NewUser($"user{n}@mail.com"))));

        Assert.That(results.Count(r => r), Is.EqualTo(1));
        await using var db = _db();
        Assert.That(await db.Set<User>().CountAsync(), Is.EqualTo(2));
    }
}
