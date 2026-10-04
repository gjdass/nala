using Microsoft.EntityFrameworkCore;
using Nala.Core.Entries;
using Nala.Core.Pumps;
using Nala.Core.Users;

namespace Nala.Sql.Pumps;

public class PumpRepository(NalaDbContext db) : IPumpRepository
{
    public async Task AddAsync(Pump pump, CancellationToken cancellationToken = default)
    {
        db.Set<Pump>().Add(pump);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Pump?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Pump>().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);

    public Task<PumpEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<Pump>().Where(p => p.Id == id)).SingleOrDefaultAsync(cancellationToken);

    /// <summary>Saves a session loaded by <see cref="GetAsync"/>.</summary>
    public async Task UpdateAsync(Pump pump, CancellationToken cancellationToken = default) =>
        await db.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(Pump pump, CancellationToken cancellationToken = default)
    {
        db.Set<Pump>().Remove(pump);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PumpEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var pumps = db.Set<Pump>().Where(p => p.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so sessions sharing a start time are paged by id without gaps or repeats.
            pumps = pumps.Where(p => EF.Functions.LessThan(
                ValueTuple.Create(p.StartTime, p.Id), ValueTuple.Create(after.StartTime, after.Id)));
        }

        return await Entries(pumps.OrderByDescending(p => p.StartTime).ThenByDescending(p => p.Id).Take(limit))
            .ToListAsync(cancellationToken);
    }

    public Task<PumpEntry?> GetLiveAsync(Guid babyId, CancellationToken cancellationToken = default) =>
        Entries(Live().Where(p => p.BabyId == babyId)).FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<PumpEntry>> ListLiveAsync(CancellationToken cancellationToken = default) =>
        await Entries(Live()).ToListAsync(cancellationToken);

    /// <summary>Sessions without an end time, oldest start first.</summary>
    private IQueryable<Pump> Live() =>
        db.Set<Pump>().Where(p => p.EndTime == null).OrderBy(p => p.StartTime).ThenBy(p => p.Id);

    private IQueryable<PumpEntry> Entries(IQueryable<Pump> pumps) =>
        from pump in pumps.AsNoTracking()
        join loggedBy in db.Set<User>() on pump.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on pump.UpdatedByUserId equals updatedBy.Id
        select new PumpEntry(pump, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
