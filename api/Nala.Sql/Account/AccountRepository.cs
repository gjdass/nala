using Microsoft.EntityFrameworkCore;
using Nala.Core.Account;
using Nala.Core.Auth;
using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Sql.Account;

public class AccountRepository(NalaDbContext db) : IAccountRepository
{
    public async Task DeleteAsync(User user, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Set<User>().Update(user);
        await db.SaveChangesAsync(cancellationToken);

        // The database cascades each family to its babies (and so their entries), memberships and invitations.
        await db.Set<Family>()
            .Where(f => db.Set<Membership>().Any(m => m.FamilyId == f.Id && m.UserId == user.Id && m.Role == FamilyRole.Admin))
            .ExecuteDeleteAsync(cancellationToken);
        await db.Set<Membership>().Where(m => m.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);
        await db.Set<Invitation>()
            .Where(i => i.CreatedByUserId == user.Id && i.UsedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, now), cancellationToken);
        await db.Set<Session>().Where(s => s.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
