using Microsoft.EntityFrameworkCore;
using Nala.Core.Babies;

namespace Nala.Sql.Babies;

public class BabyRepository(NalaDbContext db) : IBabyRepository
{
    public async Task AddAsync(Baby baby, CancellationToken cancellationToken = default)
    {
        db.Set<Baby>().Add(baby);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Baby>> ListAsync(CancellationToken cancellationToken = default) =>
        await db.Set<Baby>()
            .AsNoTracking()
            .OrderBy(b => b.BirthDate)
            .ThenBy(b => b.CreatedAt)
            .ToListAsync(cancellationToken);
}
