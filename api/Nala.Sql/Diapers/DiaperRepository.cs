using Microsoft.EntityFrameworkCore;
using Nala.Core.Diapers;
using Nala.Core.Entries;
using Nala.Core.Users;

namespace Nala.Sql.Diapers;

public class DiaperRepository(NalaDbContext db) : IDiaperRepository
{
    public async Task AddAsync(Diaper diaper, CancellationToken cancellationToken = default)
    {
        db.Set<Diaper>().Add(diaper);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Diaper?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Diaper>().SingleOrDefaultAsync(d => d.Id == id, cancellationToken);

    public Task<DiaperEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<Diaper>().Where(d => d.Id == id)).SingleOrDefaultAsync(cancellationToken);

    /// <summary>Saves a diaper loaded by <see cref="GetAsync"/>.</summary>
    public async Task UpdateAsync(Diaper diaper, CancellationToken cancellationToken = default) =>
        await db.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(Diaper diaper, CancellationToken cancellationToken = default)
    {
        db.Set<Diaper>().Remove(diaper);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DiaperEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var diapers = db.Set<Diaper>().Where(d => d.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so diapers sharing a time are paged by id without gaps or repeats.
            diapers = diapers.Where(d => EF.Functions.LessThan(
                ValueTuple.Create(d.Time, d.Id), ValueTuple.Create(after.StartTime, after.Id)));
        }

        return await Entries(diapers.OrderByDescending(d => d.Time).ThenByDescending(d => d.Id).Take(limit))
            .ToListAsync(cancellationToken);
    }

    private IQueryable<DiaperEntry> Entries(IQueryable<Diaper> diapers) =>
        from diaper in diapers.AsNoTracking()
        join loggedBy in db.Set<User>() on diaper.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on diaper.UpdatedByUserId equals updatedBy.Id
        select new DiaperEntry(diaper, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
