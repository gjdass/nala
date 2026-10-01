using Microsoft.EntityFrameworkCore;
using Nala.Core.Entries;
using Nala.Core.Sleeps;
using Nala.Core.Users;

namespace Nala.Sql.Sleeps;

public class SleepRepository(NalaDbContext db) : ISleepRepository
{
    public async Task AddAsync(Sleep sleep, CancellationToken cancellationToken = default)
    {
        db.Set<Sleep>().Add(sleep);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Sleep?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Sleep>().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);

    public Task<SleepEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<Sleep>().Where(s => s.Id == id)).SingleOrDefaultAsync(cancellationToken);

    /// <summary>Saves a sleep loaded by <see cref="GetAsync"/>.</summary>
    public async Task UpdateAsync(Sleep sleep, CancellationToken cancellationToken = default) =>
        await db.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(Sleep sleep, CancellationToken cancellationToken = default)
    {
        db.Set<Sleep>().Remove(sleep);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SleepEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var sleeps = db.Set<Sleep>().Where(s => s.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so sleeps sharing a start time are paged by id without gaps or repeats.
            sleeps = sleeps.Where(s => EF.Functions.LessThan(
                ValueTuple.Create(s.StartTime, s.Id), ValueTuple.Create(after.StartTime, after.Id)));
        }

        return await Entries(sleeps.OrderByDescending(s => s.StartTime).ThenByDescending(s => s.Id).Take(limit))
            .ToListAsync(cancellationToken);
    }

    private IQueryable<SleepEntry> Entries(IQueryable<Sleep> sleeps) =>
        from sleep in sleeps.AsNoTracking()
        join loggedBy in db.Set<User>() on sleep.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on sleep.UpdatedByUserId equals updatedBy.Id
        select new SleepEntry(sleep, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
