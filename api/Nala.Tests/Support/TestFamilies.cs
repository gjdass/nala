using Nala.Core.Families;
using Nala.Core.Users;
using Nala.Sql;

namespace Nala.Tests.Support;

/// <summary>Seeds families straight into the database, for repository tests that need one.</summary>
public static class TestFamilies
{
    /// <summary>A family administered by <paramref name="admin"/> (already saved), with <paramref name="members"/> as members.</summary>
    public static async Task<Family> SeedAsync(NalaDbContext db, User admin, params User[] members)
    {
        var family = new Family { Id = Guid.NewGuid(), Name = $"{admin.DisplayName}'s", CreatedByUserId = admin.Id, CreatedAt = admin.CreatedAt };
        db.Set<Family>().Add(family);
        db.Set<Membership>().Add(new Membership { FamilyId = family.Id, UserId = admin.Id, Role = FamilyRole.Admin, JoinedAt = admin.CreatedAt });
        db.Set<Membership>().AddRange(members.Select(m =>
            new Membership { FamilyId = family.Id, UserId = m.Id, Role = FamilyRole.Member, JoinedAt = m.CreatedAt }));
        await db.SaveChangesAsync();
        return family;
    }
}
