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

    public Task<Baby?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Baby>().SingleOrDefaultAsync(b => b.Id == id, cancellationToken);

    public async Task UpdateAsync(Baby baby, CancellationToken cancellationToken = default)
    {
        db.Set<Baby>().Update(baby);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Baby baby, CancellationToken cancellationToken = default)
    {
        db.Set<Baby>().Remove(baby);
        await db.SaveChangesAsync(cancellationToken);
    }
}
