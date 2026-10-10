using Microsoft.EntityFrameworkCore;
using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Sql.Users;

namespace Nala.Sql.Invitations;

public class InvitationRepository(NalaDbContext db) : IInvitationRepository
{
    public async Task AddAsync(Invitation invitation, CancellationToken cancellationToken = default)
    {
        db.Set<Invitation>().Add(invitation);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        db.Set<Invitation>().SingleOrDefaultAsync(i => i.TokenHash == tokenHash, cancellationToken);

    public Task<Invitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Invitation>().AsNoTracking().SingleOrDefaultAsync(i => i.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Invitation>> ListPendingAsync(DateTimeOffset now, CancellationToken cancellationToken = default) =>
        await db.Set<Invitation>().AsNoTracking()
            .Where(i => i.UsedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ToListAsync(cancellationToken);

    // Conditional update: a registration using the link at the same time can't also succeed.
    public async Task<bool> RevokeAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default) =>
        await db.Set<Invitation>()
            .Where(i => i.Id == id && i.UsedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, now), cancellationToken) == 1;

    public async Task<bool> RedeemAsync(
        Guid invitationId, User user, Membership? membership, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // The user row first: used_by_user_id references it. A taken email throws and rolls back.
        await new UserRepository(db).AddAsync(user, cancellationToken);

        // Conditional update: of concurrent registrations on one link, only the first to lock the row gets it.
        var redeemed = await db.Set<Invitation>()
            .Where(i => i.Id == invitationId && i.UsedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ExecuteUpdateAsync(
                s => s.SetProperty(i => i.UsedAt, now).SetProperty(i => i.UsedByUserId, user.Id),
                cancellationToken);
        if (redeemed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            db.Entry(user).State = EntityState.Detached;
            return false;
        }

        if (membership is not null)
        {
            db.Set<Membership>().Add(membership);
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public Task RevokePendingAsync(Guid createdByUserId, DateTimeOffset now, CancellationToken cancellationToken = default) =>
        db.Set<Invitation>()
            .Where(i => i.CreatedByUserId == createdByUserId && i.UsedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, now), cancellationToken);
}
