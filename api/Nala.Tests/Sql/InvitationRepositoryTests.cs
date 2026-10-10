using Microsoft.EntityFrameworkCore;
using Nala.Core.Auth;
using Nala.Core.Families;
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

    private async Task<Invitation> InviteAsync(Action<Invitation>? change = null, Guid? createdBy = null, Guid? familyId = null)
    {
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            TokenHash = LinkToken.Hash(LinkToken.Generate()),
            CreatedByUserId = createdBy ?? _anna.Id,
            CreatedAt = Now,
            ExpiresAt = Now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        await using var db = _db();
        await new InvitationRepository(db).AddAsync(invitation);
        return invitation;
    }

    private async Task<bool> RedeemAsync(Invitation invitation, User user, DateTimeOffset? now = null, Membership? membership = null)
    {
        await using var db = _db();
        return await new InvitationRepository(db).RedeemAsync(invitation.Id, user, membership, now ?? Now);
    }

    private async Task<List<Membership>> MembershipsAsync()
    {
        await using var db = _db();
        return await db.Set<Membership>().AsNoTracking().ToListAsync();
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
    public async Task Redeem_saves_the_membership()
    {
        Family family;
        await using (var db = _db())
        {
            family = await TestFamilies.SeedAsync(db, _anna);
        }

        var invitation = await InviteAsync();
        var ben = NewUser("ben@mail.com");
        var membership = new Membership { FamilyId = family.Id, UserId = ben.Id, Role = FamilyRole.Member, JoinedAt = Now };

        Assert.That(await RedeemAsync(invitation, ben, membership: membership), Is.True);

        var saved = (await MembershipsAsync()).Single(m => m.UserId == ben.Id);
        Assert.That(
            new { saved.FamilyId, saved.Role, saved.JoinedAt },
            Is.EqualTo(new { FamilyId = family.Id, Role = FamilyRole.Member, JoinedAt = Now }));
    }

    [Test]
    public async Task Redeem_of_a_used_invitation_saves_no_membership()
    {
        Family family;
        await using (var db = _db())
        {
            family = await TestFamilies.SeedAsync(db, _anna);
        }

        var invitation = await InviteAsync();
        await RedeemAsync(invitation, NewUser("ben@mail.com"));
        var carl = NewUser("carl@mail.com");
        var membership = new Membership { FamilyId = family.Id, UserId = carl.Id, Role = FamilyRole.Member, JoinedAt = Now };

        Assert.That(await RedeemAsync(invitation, carl, membership: membership), Is.False);
        Assert.That((await MembershipsAsync()).Select(m => m.UserId), Is.EqualTo(new[] { _anna.Id }));
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

    [Test]
    public async Task RevokePending_revokes_only_the_users_pending_invitations()
    {
        var ben = NewUser("ben@mail.com");
        await using (var db = _db())
        {
            await new UserRepository(db).AddAsync(ben);
        }

        var pending = await InviteAsync();
        var used = await InviteAsync(i =>
        {
            i.UsedAt = Now.AddDays(-1);
            i.UsedByUserId = ben.Id;
        });
        var expired = await InviteAsync(i => i.ExpiresAt = Now.AddDays(-1));
        var revoked = await InviteAsync(i => i.RevokedAt = Now.AddDays(-2));
        var bens = await InviteAsync(createdBy: ben.Id);

        await using (var db = _db())
        {
            await new InvitationRepository(db).RevokePendingAsync(_anna.Id, Now);
        }

        Assert.That((await ReadAsync(pending)).RevokedAt, Is.EqualTo(Now));
        Assert.That((await ReadAsync(used)).RevokedAt, Is.Null);
        Assert.That((await ReadAsync(expired)).RevokedAt, Is.Null);
        Assert.That((await ReadAsync(revoked)).RevokedAt, Is.EqualTo(Now.AddDays(-2)));
        Assert.That((await ReadAsync(bens)).RevokedAt, Is.Null);
    }
    [Test]
    public async Task GetById_reads_the_invitation()
    {
        var invitation = await InviteAsync();

        await using var db = _db();
        var repository = new InvitationRepository(db);
        Assert.That((await repository.GetByIdAsync(invitation.Id))!.TokenHash, Is.EqualTo(invitation.TokenHash));
        Assert.That(await repository.GetByIdAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task ListPending_returns_only_usable_invitations_of_the_family()
    {
        var ben = NewUser("ben@mail.com");
        Family martins, others;
        await using (var db = _db())
        {
            await new UserRepository(db).AddAsync(ben);
            martins = await TestFamilies.SeedAsync(db, _anna, ben);
            others = await TestFamilies.SeedAsync(db, ben);
        }

        var pending = await InviteAsync(familyId: martins.Id);
        var bens = await InviteAsync(createdBy: ben.Id, familyId: martins.Id);
        await InviteAsync(createdBy: ben.Id, familyId: others.Id);
        await InviteAsync(); // A new-family invitation: no family.
        await InviteAsync(
            i =>
            {
                i.UsedAt = Now.AddDays(-1);
                i.UsedByUserId = ben.Id;
            },
            familyId: martins.Id);
        await InviteAsync(i => i.RevokedAt = Now.AddDays(-1), familyId: martins.Id);
        await InviteAsync(i => i.ExpiresAt = Now, familyId: martins.Id);

        await using (var db = _db())
        {
            var listed = await new InvitationRepository(db).ListPendingAsync(martins.Id, Now);
            Assert.That(listed.Select(i => i.Id), Is.EquivalentTo(new[] { pending.Id, bens.Id }));
        }
    }

    [Test]
    public async Task Revoke_marks_a_pending_invitation()
    {
        var invitation = await InviteAsync();

        await using (var db = _db())
        {
            Assert.That(await new InvitationRepository(db).RevokeAsync(invitation.Id, Now.AddHours(1)), Is.True);
        }

        Assert.That((await ReadAsync(invitation)).RevokedAt, Is.EqualTo(Now.AddHours(1)));
    }

    [Test]
    public async Task Revoke_leaves_a_used_revoked_or_expired_invitation_untouched()
    {
        var ben = NewUser("ben@mail.com");
        await using (var db = _db())
        {
            await new UserRepository(db).AddAsync(ben);
        }

        var used = await InviteAsync(i =>
        {
            i.UsedAt = Now.AddDays(-1);
            i.UsedByUserId = ben.Id;
        });
        var revoked = await InviteAsync(i => i.RevokedAt = Now.AddDays(-1));
        var expired = await InviteAsync(i => i.ExpiresAt = Now);

        foreach (var invitation in new[] { used, revoked, expired })
        {
            await using var db = _db();
            Assert.That(await new InvitationRepository(db).RevokeAsync(invitation.Id, Now), Is.False);
        }

        Assert.That((await ReadAsync(used)).RevokedAt, Is.Null);
        Assert.That((await ReadAsync(revoked)).RevokedAt, Is.EqualTo(Now.AddDays(-1)));
        Assert.That((await ReadAsync(expired)).RevokedAt, Is.Null);
    }

    private async Task<(Family Family, User Ben)> FamilyAndBenAsync()
    {
        var ben = NewUser("ben@mail.com");
        await using var db = _db();
        await new UserRepository(db).AddAsync(ben);
        return (await TestFamilies.SeedAsync(db, _anna), ben);
    }

    private async Task<bool> AcceptAsync(Invitation invitation, Membership membership)
    {
        await using var db = _db();
        return await new InvitationRepository(db).AcceptAsync(invitation.Id, membership, Now.AddHours(1));
    }

    private static Membership MemberOf(Family family, User user) =>
        new() { FamilyId = family.Id, UserId = user.Id, Role = FamilyRole.Member, JoinedAt = Now.AddHours(1) };

    [Test]
    public async Task Accept_saves_the_membership_and_marks_the_invitation_used()
    {
        var (family, ben) = await FamilyAndBenAsync();
        var invitation = await InviteAsync(familyId: family.Id);

        Assert.That(await AcceptAsync(invitation, MemberOf(family, ben)), Is.True);

        var saved = (await MembershipsAsync()).Single(m => m.UserId == ben.Id);
        Assert.That(
            new { saved.FamilyId, saved.Role, saved.JoinedAt },
            Is.EqualTo(new { FamilyId = family.Id, Role = FamilyRole.Member, JoinedAt = Now.AddHours(1) }));
        var read = await ReadAsync(invitation);
        Assert.That(read.UsedAt, Is.EqualTo(Now.AddHours(1)));
        Assert.That(read.UsedByUserId, Is.EqualTo(ben.Id));
    }

    [Test]
    public async Task Accept_of_a_used_revoked_or_expired_invitation_saves_nothing()
    {
        var (family, ben) = await FamilyAndBenAsync();
        var used = await InviteAsync(i => { i.UsedAt = Now; i.UsedByUserId = _anna.Id; }, familyId: family.Id);
        var revoked = await InviteAsync(i => i.RevokedAt = Now, familyId: family.Id);
        var expired = await InviteAsync(i => i.ExpiresAt = Now, familyId: family.Id);

        foreach (var invitation in new[] { used, revoked, expired })
        {
            Assert.That(await AcceptAsync(invitation, MemberOf(family, ben)), Is.False);
        }

        Assert.That((await MembershipsAsync()).Any(m => m.UserId == ben.Id), Is.False);
        Assert.That((await ReadAsync(revoked)).UsedAt, Is.Null);
    }

    [Test]
    public async Task Accept_with_an_existing_membership_throws_and_leaves_the_invitation_unused()
    {
        var (family, _) = await FamilyAndBenAsync();
        var invitation = await InviteAsync(familyId: family.Id);

        Assert.That(() => AcceptAsync(invitation, MemberOf(family, _anna)), Throws.InstanceOf<MembershipConflictException>());

        Assert.That((await ReadAsync(invitation)).UsedAt, Is.Null);
        Assert.That((await MembershipsAsync()).Single(m => m.UserId == _anna.Id).Role, Is.EqualTo(FamilyRole.Admin));
    }
}
