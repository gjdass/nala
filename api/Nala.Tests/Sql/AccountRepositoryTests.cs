using Microsoft.EntityFrameworkCore;
using Nala.Core.Auth;
using Nala.Core.Babies;
using Nala.Core.Families;
using Nala.Core.Feeds;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Account;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class AccountRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 10, 12, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
    private User _carl = null!;
    private User _anna = null!;

    [SetUp]
    public async Task SetUp()
    {
        _db = await TestDatabase.CreateAsync();
        _anna = NewUser("Anna");
        _carl = NewUser("Carl");
        await using var db = _db();
        db.Set<User>().AddRange(_anna, _carl);
        await db.SaveChangesAsync();
    }

    private static User NewUser(string name) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name.ToLowerInvariant()}@mail.com",
        DisplayName = name,
        PasswordHash = "hash",
        PreferredLanguage = "en",
        CreatedAt = Now,
    };

    private async Task<Family> SeedFamilyAsync(User admin, params User[] members)
    {
        await using var db = _db();
        return await TestFamilies.SeedAsync(db, admin, members);
    }

    private async Task<Baby> SeedBabyAsync(Family family, User by)
    {
        var baby = new Baby
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            Name = "Lea",
            BirthDate = new DateOnly(2026, 9, 1),
            CreatedByUserId = by.Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = _db();
        db.Set<Baby>().Add(baby);
        await db.SaveChangesAsync();
        return baby;
    }

    private async Task<Feed> SeedFeedAsync(Baby baby, User by)
    {
        var feed = new Feed
        {
            Id = Guid.NewGuid(),
            BabyId = baby.Id,
            Kind = FeedKind.Bottle,
            StartTime = Now,
            MilkType = MilkType.Formula,
            AmountMl = 120,
            LoggedByUserId = by.Id,
            CreatedAt = Now,
            UpdatedAt = Now,
            UpdatedByUserId = by.Id,
        };
        await using var db = _db();
        db.Set<Feed>().Add(feed);
        await db.SaveChangesAsync();
        return feed;
    }

    private async Task<Invitation> SeedInvitationAsync(User by, Family? family, Action<Invitation>? change = null)
    {
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = Guid.NewGuid().ToString(),
            FamilyId = family?.Id,
            CreatedByUserId = by.Id,
            CreatedAt = Now,
            ExpiresAt = Now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        await using var db = _db();
        db.Set<Invitation>().Add(invitation);
        await db.SaveChangesAsync();
        return invitation;
    }

    private async Task<Session> SeedSessionAsync(User user)
    {
        var session = new Session { Id = Guid.NewGuid(), UserId = user.Id, CreatedAt = Now, LastSeenAt = Now };
        await using var db = _db();
        db.Set<Session>().Add(session);
        await db.SaveChangesAsync();
        return session;
    }

    /// <summary>Deletes Carl's account the way the service does: soft-delete fields set, then the repository call.</summary>
    private async Task DeleteCarlAsync()
    {
        await using var db = _db();
        var carl = await db.Set<User>().SingleAsync(u => u.Id == _carl.Id);
        carl.DeletedAt = Now;
        carl.Email = null;
        carl.PasswordHash = null;
        await new AccountRepository(db).DeleteAsync(carl, Now);
    }

    [Test]
    public async Task Delete_saves_the_soft_deleted_user()
    {
        await DeleteCarlAsync();

        await using var db = _db();
        var carl = await db.Set<User>().SingleAsync(u => u.Id == _carl.Id);
        Assert.That(carl.DeletedAt, Is.EqualTo(Now));
        Assert.That(carl.Email, Is.Null);
        Assert.That(carl.PasswordHash, Is.Null);
        Assert.That(carl.DisplayName, Is.EqualTo("Carl"));
    }

    [Test]
    public async Task Delete_ends_all_sessions_of_the_user_only()
    {
        await SeedSessionAsync(_carl);
        await SeedSessionAsync(_carl);
        var annas = await SeedSessionAsync(_anna);

        await DeleteCarlAsync();

        await using var db = _db();
        Assert.That(await db.Set<Session>().Select(s => s.Id).ToListAsync(), Is.EquivalentTo(new[] { annas.Id }));
    }

    [Test]
    public async Task Delete_revokes_only_the_users_pending_invitations()
    {
        var annasFamily = await SeedFamilyAsync(_anna, _carl);
        var pending = await SeedInvitationAsync(_carl, annasFamily);
        var newFamily = await SeedInvitationAsync(_carl, null);
        var used = await SeedInvitationAsync(_carl, annasFamily, i => i.UsedAt = Now.AddDays(-1));
        var expired = await SeedInvitationAsync(_carl, annasFamily, i => i.ExpiresAt = Now.AddDays(-1));
        var revoked = await SeedInvitationAsync(_carl, annasFamily, i => i.RevokedAt = Now.AddDays(-2));
        var annas = await SeedInvitationAsync(_anna, annasFamily);

        await DeleteCarlAsync();

        await using var db = _db();
        var revokedAt = await db.Set<Invitation>().ToDictionaryAsync(i => i.Id, i => i.RevokedAt);
        Assert.That(revokedAt[pending.Id], Is.EqualTo(Now));
        Assert.That(revokedAt[newFamily.Id], Is.EqualTo(Now));
        Assert.That(revokedAt[used.Id], Is.Null);
        Assert.That(revokedAt[expired.Id], Is.Null);
        Assert.That(revokedAt[revoked.Id], Is.EqualTo(Now.AddDays(-2)));
        Assert.That(revokedAt[annas.Id], Is.Null);
    }

    [Test]
    public async Task Delete_ends_the_users_memberships_in_families_they_dont_administer()
    {
        var dan = NewUser("Dan");
        await using (var db = _db())
        {
            db.Set<User>().Add(dan);
            await db.SaveChangesAsync();
        }

        var annasFamily = await SeedFamilyAsync(_anna, _carl, dan);
        var baby = await SeedBabyAsync(annasFamily, _anna);

        await DeleteCarlAsync();

        await using (var db = _db())
        {
            var members = await db.Set<Membership>().Where(m => m.FamilyId == annasFamily.Id).Select(m => m.UserId).ToListAsync();
            Assert.That(members, Is.EquivalentTo(new[] { _anna.Id, dan.Id }));
            Assert.That(await db.Set<Family>().AnyAsync(f => f.Id == annasFamily.Id), Is.True);
            Assert.That(await db.Set<Baby>().AnyAsync(b => b.Id == baby.Id), Is.True);
        }
    }

    [Test]
    public async Task Delete_deletes_the_families_the_user_administers_with_their_babies_entries_memberships_and_invitations()
    {
        var carlsFamily = await SeedFamilyAsync(_carl, _anna);
        var carlsBaby = await SeedBabyAsync(carlsFamily, _anna);
        await SeedFeedAsync(carlsBaby, _anna);
        await SeedInvitationAsync(_anna, carlsFamily, i => i.UsedAt = Now.AddDays(-1));
        await SeedInvitationAsync(_anna, carlsFamily);
        var annasFamily = await SeedFamilyAsync(_anna);
        var annasBaby = await SeedBabyAsync(annasFamily, _anna);
        var annasFeed = await SeedFeedAsync(annasBaby, _anna);
        var annasInvitation = await SeedInvitationAsync(_anna, annasFamily);

        await DeleteCarlAsync();

        await using var db = _db();
        Assert.That(await db.Set<Family>().Select(f => f.Id).ToListAsync(), Is.EquivalentTo(new[] { annasFamily.Id }));
        Assert.That(await db.Set<Baby>().Select(b => b.Id).ToListAsync(), Is.EquivalentTo(new[] { annasBaby.Id }));
        Assert.That(await db.Set<Feed>().Select(f => f.Id).ToListAsync(), Is.EquivalentTo(new[] { annasFeed.Id }));
        Assert.That(await db.Set<Invitation>().Select(i => i.Id).ToListAsync(), Is.EquivalentTo(new[] { annasInvitation.Id }));
        Assert.That(
            await db.Set<Membership>().Select(m => new { m.FamilyId, m.UserId }).ToListAsync(),
            Is.EquivalentTo(new[] { new { FamilyId = annasFamily.Id, UserId = _anna.Id } }));
    }

    [Test]
    public async Task Delete_keeps_the_entries_the_user_logged_in_other_families()
    {
        var annasFamily = await SeedFamilyAsync(_anna, _carl);
        var baby = await SeedBabyAsync(annasFamily, _carl);
        var carlsFeed = await SeedFeedAsync(baby, _carl);

        await DeleteCarlAsync();

        await using var db = _db();
        var feed = await db.Set<Feed>().SingleAsync(f => f.Id == carlsFeed.Id);
        Assert.That(feed.LoggedByUserId, Is.EqualTo(_carl.Id));
        Assert.That(feed.AmountMl, Is.EqualTo(120));
    }
}
