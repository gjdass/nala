using Microsoft.EntityFrameworkCore;
using Nala.Core.Entries;
using Nala.Core.GrowthEntries;
using Nala.Core.Users;

namespace Nala.Sql.GrowthEntries;

public class GrowthEntryRepository(NalaDbContext db) : IGrowthEntryRepository
{
    public async Task AddAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default)
    {
        db.Set<GrowthEntry>().Add(growthEntry);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<GrowthEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<GrowthEntry>().SingleOrDefaultAsync(g => g.Id == id, cancellationToken);

    public Task<GrowthEntryDetails?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<GrowthEntry>().Where(g => g.Id == id)).SingleOrDefaultAsync(cancellationToken);

    /// <summary>Saves a growth entry loaded by <see cref="GetAsync"/>.</summary>
    public async Task UpdateAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default) =>
        await db.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default)
    {
        db.Set<GrowthEntry>().Remove(growthEntry);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<GrowthEntryDetails>> ListAsync(
        Guid babyId, GrowthEntryCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var growthEntries = db.Set<GrowthEntry>().Where(g => g.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so entries sharing a date and creation time are paged by id without gaps or repeats.
            growthEntries = growthEntries.Where(g => EF.Functions.LessThan(
                ValueTuple.Create(g.Date, g.CreatedAt, g.Id), ValueTuple.Create(after.Date, after.CreatedAt, after.Id)));
        }

        return await Entries(Newest(growthEntries).Take(limit)).ToListAsync(cancellationToken);
    }

    public async Task<GrowthLatest> LatestAsync(Guid babyId, CancellationToken cancellationToken = default)
    {
        var ofBaby = Newest(db.Set<GrowthEntry>().AsNoTracking().Where(g => g.BabyId == babyId));
        var weight = await ofBaby.Where(g => g.WeightG != null)
            .Select(g => new LatestMeasure(g.WeightG!.Value, g.Date, false)).FirstOrDefaultAsync(cancellationToken);
        var length = await ofBaby.Where(g => g.LengthCm != null)
            .Select(g => new LatestMeasure(g.LengthCm!.Value, g.Date, false)).FirstOrDefaultAsync(cancellationToken);
        var head = await ofBaby.Where(g => g.HeadCircumferenceCm != null)
            .Select(g => new LatestMeasure(g.HeadCircumferenceCm!.Value, g.Date, false)).FirstOrDefaultAsync(cancellationToken);
        return new GrowthLatest(weight, length, head);
    }

    /// <summary>Newest date first, then newest created, then id (spec 10 order).</summary>
    private static IOrderedQueryable<GrowthEntry> Newest(IQueryable<GrowthEntry> growthEntries) =>
        growthEntries.OrderByDescending(g => g.Date).ThenByDescending(g => g.CreatedAt).ThenByDescending(g => g.Id);

    private IQueryable<GrowthEntryDetails> Entries(IQueryable<GrowthEntry> growthEntries) =>
        from growthEntry in growthEntries.AsNoTracking()
        join loggedBy in db.Set<User>() on growthEntry.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on growthEntry.UpdatedByUserId equals updatedBy.Id
        select new GrowthEntryDetails(growthEntry, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
