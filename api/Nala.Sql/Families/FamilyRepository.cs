using Microsoft.EntityFrameworkCore;
using Nala.Core.Families;
using Nala.Core.Users;
using Npgsql;

namespace Nala.Sql.Families;

public class FamilyRepository(NalaDbContext db) : IFamilyRepository
{
    // One SaveChanges is one transaction: a taken email or a second instance admin saves nothing.
    public async Task AddWithNewAdminAsync(User admin, Family family, Membership membership, CancellationToken cancellationToken = default)
    {
        db.Set<User>().Add(admin);
        db.Set<Family>().Add(family);
        db.Set<Membership>().Add(membership);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(admin).State = EntityState.Detached;
            db.Entry(family).State = EntityState.Detached;
            db.Entry(membership).State = EntityState.Detached;
            throw new UserConflictException(e);
        }
    }

    public Task<FamilyRole?> GetRoleAsync(Guid familyId, Guid userId, CancellationToken cancellationToken = default) =>
        db.Set<Membership>().AsNoTracking()
            .Where(m => m.FamilyId == familyId && m.UserId == userId)
            .Select(m => (FamilyRole?)m.Role)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<Family?> RenameAsync(Guid familyId, string name, CancellationToken cancellationToken = default)
    {
        if (await db.Set<Family>().SingleOrDefaultAsync(f => f.Id == familyId, cancellationToken) is not { } family)
        {
            return null;
        }

        family.Name = name;
        await db.SaveChangesAsync(cancellationToken);
        return family;
    }

    public async Task<IReadOnlyList<UserFamily>> ListForUserAsync(Guid userId, CancellationToken cancellationToken = default) =>
        (await db.Set<Membership>().AsNoTracking()
            .Where(m => m.UserId == userId)
            .Join(db.Set<Family>(), m => m.FamilyId, f => f.Id, (m, f) => new { Family = f, m.Role })
            .ToListAsync(cancellationToken))
        .Select(r => new UserFamily(r.Family, r.Role))
        .ToList();
}
