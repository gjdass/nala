using Microsoft.EntityFrameworkCore;
using Nala.Core.HealthEntries;
using Nala.Core.Entries;
using Nala.Core.Users;

namespace Nala.Sql.HealthEntries;

public class HealthEntryRepository(NalaDbContext db) : IHealthEntryRepository
{
    public async Task AddAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default)
    {
        db.Set<HealthEntry>().Add(healthEntry);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<HealthEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<HealthEntry>().SingleOrDefaultAsync(m => m.Id == id, cancellationToken);

    public Task<HealthEntryDetails?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<HealthEntry>().Where(m => m.Id == id)).SingleOrDefaultAsync(cancellationToken);

    /// <summary>Saves a health entry loaded by <see cref="GetAsync"/>.</summary>
    public async Task UpdateAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default) =>
        await db.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default)
    {
        db.Set<HealthEntry>().Remove(healthEntry);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<HealthEntryDetails>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var healthEntries = db.Set<HealthEntry>().Where(m => m.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so health entries sharing a time are paged by id without gaps or repeats.
            healthEntries = healthEntries.Where(m => EF.Functions.LessThan(
                ValueTuple.Create(m.Time, m.Id), ValueTuple.Create(after.StartTime, after.Id)));
        }

        return await Entries(healthEntries.OrderByDescending(m => m.Time).ThenByDescending(m => m.Id).Take(limit))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RecentMedicine>> ListRecentAsync(Guid babyId, int limit, CancellationToken cancellationToken = default)
    {
        var ofBaby = db.Set<HealthEntry>().AsNoTracking().Where(m => m.BabyId == babyId);
        // The latest dose of each name: no later one (time, then id) with the same name whatever its case.
        return await ofBaby
            .Where(m => !ofBaby.Any(later => later.Name.ToLower() == m.Name.ToLower()
                && EF.Functions.GreaterThan(ValueTuple.Create(later.Time, later.Id), ValueTuple.Create(m.Time, m.Id))))
            .OrderByDescending(m => m.Time)
            .ThenByDescending(m => m.Id)
            .Take(limit)
            .Select(m => new RecentMedicine(m.Name, m.Amount, m.Unit))
            .ToListAsync(cancellationToken);
    }

    private IQueryable<HealthEntryDetails> Entries(IQueryable<HealthEntry> healthEntries) =>
        from healthEntry in healthEntries.AsNoTracking()
        join loggedBy in db.Set<User>() on healthEntry.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on healthEntry.UpdatedByUserId equals updatedBy.Id
        select new HealthEntryDetails(healthEntry, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
