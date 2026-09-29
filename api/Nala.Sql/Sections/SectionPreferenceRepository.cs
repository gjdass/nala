using Microsoft.EntityFrameworkCore;
using Nala.Core.Sections;

namespace Nala.Sql.Sections;

public class SectionPreferenceRepository(NalaDbContext db) : ISectionPreferenceRepository
{
    public async Task<IReadOnlyList<SectionPreference>> ListAsync(Guid userId, CancellationToken cancellationToken = default) =>
        await db.Set<SectionPreference>()
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderBy(p => p.Position)
            .ToListAsync(cancellationToken);

    public async Task ReplaceAsync(
        Guid userId, IReadOnlyList<SectionPreference> preferences, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Set<SectionPreference>().Where(p => p.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        db.Set<SectionPreference>().AddRange(preferences);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
