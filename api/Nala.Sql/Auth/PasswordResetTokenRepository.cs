using Microsoft.EntityFrameworkCore;
using Nala.Core.Auth;

namespace Nala.Sql.Auth;

public class PasswordResetTokenRepository(NalaDbContext db) : IPasswordResetTokenRepository
{
    public async Task ReplaceAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Set<PasswordResetToken>()
            .Where(t => t.UserId == token.UserId && t.UsedAt == null)
            .ExecuteDeleteAsync(cancellationToken);
        db.Set<PasswordResetToken>().Add(token);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public Task<PasswordResetToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        db.Set<PasswordResetToken>().SingleOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

    /// <summary>Conditional update: of concurrent resets with one link, only the first to lock the row gets it.</summary>
    public async Task<bool> ConsumeAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default) =>
        await db.Set<PasswordResetToken>()
            .Where(t => t.Id == id && t.UsedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), cancellationToken) == 1;
}
