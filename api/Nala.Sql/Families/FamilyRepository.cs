using Microsoft.EntityFrameworkCore;
using Nala.Core.Families;
using Nala.Core.Invitations;
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

    public Task<Family?> GetAsync(Guid familyId, CancellationToken cancellationToken = default) =>
        db.Set<Family>().AsNoTracking().SingleOrDefaultAsync(f => f.Id == familyId, cancellationToken);

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

    public async Task<IReadOnlyList<FamilyMember>> ListMembersAsync(Guid familyId, CancellationToken cancellationToken = default) =>
        (await db.Set<Membership>().AsNoTracking()
            .Where(m => m.FamilyId == familyId)
            .Join(db.Set<User>().Where(u => u.DeletedAt == null), m => m.UserId, u => u.Id, (m, u) => new { User = u, m.Role })
            .ToListAsync(cancellationToken))
        .Select(r => new FamilyMember(r.User, r.Role))
        .ToList();

    public async Task<bool> RemoveMemberAsync(Guid familyId, Guid userId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var removed = await db.Set<Membership>()
            .Where(m => m.FamilyId == familyId && m.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        if (removed == 0)
        {
            return false;
        }

        await db.Set<Invitation>()
            .Where(i => i.FamilyId == familyId && i.CreatedByUserId == userId
                && i.UsedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, now), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }
}
