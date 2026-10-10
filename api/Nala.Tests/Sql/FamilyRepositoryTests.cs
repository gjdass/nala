using Microsoft.EntityFrameworkCore;
using Nala.Core.Families;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Families;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class FamilyRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 10, 12, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;

    [SetUp]
    public async Task SetUp() => _db = await TestDatabase.CreateAsync();

    private static User NewUser(string name, bool isAdmin = false) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name.ToLowerInvariant()}@mail.com",
        DisplayName = name,
        PasswordHash = "hash",
        PreferredLanguage = "en",
        IsAdmin = isAdmin,
        CreatedAt = Now,
    };

    private static (Family Family, Membership Membership) NewFamily(User admin, string name = "Martins")
    {
        var family = new Family { Id = Guid.NewGuid(), Name = name, CreatedByUserId = admin.Id, CreatedAt = Now };
        return (family, new Membership { FamilyId = family.Id, UserId = admin.Id, Role = FamilyRole.Admin, JoinedAt = Now });
    }

    private async Task AddWithNewAdminAsync(User admin, Family family, Membership membership)
    {
        await using var db = _db();
        await new FamilyRepository(db).AddWithNewAdminAsync(admin, family, membership);
    }

    private async Task AddUserAsync(User user)
    {
        await using var db = _db();
        await new UserRepository(db).AddAsync(user);
    }

    private async Task AddMembershipAsync(Family family, User user, FamilyRole role)
    {
        await using var db = _db();
        db.Set<Membership>().Add(new Membership { FamilyId = family.Id, UserId = user.Id, Role = role, JoinedAt = Now });
        await db.SaveChangesAsync();
    }

    [Test]
    public async Task AddWithNewAdmin_saves_user_family_and_membership()
    {
        var anna = NewUser("Anna", isAdmin: true);
        var (family, membership) = NewFamily(anna);

        await AddWithNewAdminAsync(anna, family, membership);

        await using var db = _db();
        Assert.That(await db.Set<User>().AnyAsync(u => u.Id == anna.Id), Is.True);
        var saved = await db.Set<Family>().SingleAsync();
        Assert.That(
            new { saved.Id, saved.Name, saved.CreatedByUserId, saved.CreatedAt },
            Is.EqualTo(new { family.Id, Name = "Martins", CreatedByUserId = anna.Id, CreatedAt = Now }));
        var savedMembership = await db.Set<Membership>().SingleAsync();
        Assert.That(
            new { savedMembership.FamilyId, savedMembership.UserId, savedMembership.Role, savedMembership.JoinedAt },
            Is.EqualTo(new { FamilyId = family.Id, UserId = anna.Id, Role = FamilyRole.Admin, JoinedAt = Now }));
    }

    [Test]
    public async Task AddWithNewAdmin_with_a_taken_email_saves_nothing()
    {
        await AddUserAsync(NewUser("Anna"));
        var other = NewUser("Anna");
        var (family, membership) = NewFamily(other);

        Assert.That(() => AddWithNewAdminAsync(other, family, membership), Throws.InstanceOf<UserConflictException>());

        await using var db = _db();
        Assert.That(await db.Set<Family>().AnyAsync(), Is.False);
        Assert.That(await db.Set<Membership>().AnyAsync(), Is.False);
    }

    [Test]
    public async Task A_second_admin_for_a_family_is_refused()
    {
        var anna = NewUser("Anna");
        var (family, membership) = NewFamily(anna);
        await AddWithNewAdminAsync(anna, family, membership);
        var ben = NewUser("Ben");
        await AddUserAsync(ben);

        Assert.That(() => AddMembershipAsync(family, ben, FamilyRole.Admin), Throws.InstanceOf<DbUpdateException>());
    }

    [Test]
    public async Task A_user_has_one_membership_per_family()
    {
        var anna = NewUser("Anna");
        var (family, membership) = NewFamily(anna);
        await AddWithNewAdminAsync(anna, family, membership);

        Assert.That(() => AddMembershipAsync(family, anna, FamilyRole.Member), Throws.InstanceOf<DbUpdateException>());
    }

    [Test]
    public async Task ListForUser_returns_the_users_families_with_their_role()
    {
        var anna = NewUser("Anna");
        var (annas, annaAdmin) = NewFamily(anna, "Martins");
        await AddWithNewAdminAsync(anna, annas, annaAdmin);
        var ben = NewUser("Ben");
        var (bens, benAdmin) = NewFamily(ben, "Durands");
        await AddWithNewAdminAsync(ben, bens, benAdmin);
        var carl = NewUser("Carl");
        var (carls, carlAdmin) = NewFamily(carl, "Carl's");
        await AddWithNewAdminAsync(carl, carls, carlAdmin);
        await AddMembershipAsync(bens, anna, FamilyRole.Member);

        await using var db = _db();
        var listed = await new FamilyRepository(db).ListForUserAsync(anna.Id);

        Assert.That(
            listed.Select(f => (f.Family.Id, f.Family.Name, f.Role)),
            Is.EquivalentTo(new[] { (annas.Id, "Martins", FamilyRole.Admin), (bens.Id, "Durands", FamilyRole.Member) }));
    }

    [Test]
    public async Task GetRole_returns_the_users_role_in_the_family_or_null()
    {
        var anna = NewUser("Anna");
        var (martins, annaAdmin) = NewFamily(anna, "Martins");
        await AddWithNewAdminAsync(anna, martins, annaAdmin);
        var ben = NewUser("Ben");
        await AddUserAsync(ben);
        await AddMembershipAsync(martins, ben, FamilyRole.Member);
        var carl = NewUser("Carl");
        var (others, carlAdmin) = NewFamily(carl, "Others");
        await AddWithNewAdminAsync(carl, others, carlAdmin);

        await using var db = _db();
        var repository = new FamilyRepository(db);
        Assert.Multiple(async () =>
        {
            Assert.That(await repository.GetRoleAsync(martins.Id, anna.Id), Is.EqualTo(FamilyRole.Admin));
            Assert.That(await repository.GetRoleAsync(martins.Id, ben.Id), Is.EqualTo(FamilyRole.Member));
            Assert.That(await repository.GetRoleAsync(others.Id, anna.Id), Is.Null);
            Assert.That(await repository.GetRoleAsync(Guid.NewGuid(), anna.Id), Is.Null);
        });
    }

    [Test]
    public async Task Rename_saves_the_name_and_returns_the_family()
    {
        var anna = NewUser("Anna");
        var (martins, annaAdmin) = NewFamily(anna, "Martins");
        await AddWithNewAdminAsync(anna, martins, annaAdmin);

        Family? renamed;
        await using (var db = _db())
        {
            renamed = await new FamilyRepository(db).RenameAsync(martins.Id, "The Martins");
        }

        Assert.That(renamed?.Id, Is.EqualTo(martins.Id));
        Assert.That(renamed?.Name, Is.EqualTo("The Martins"));
        await using var check = _db();
        Assert.That((await check.Set<Family>().SingleAsync()).Name, Is.EqualTo("The Martins"));
    }

    [Test]
    public async Task Rename_of_an_unknown_family_returns_null()
    {
        await using var db = _db();

        Assert.That(await new FamilyRepository(db).RenameAsync(Guid.NewGuid(), "The Martins"), Is.Null);
    }
}
