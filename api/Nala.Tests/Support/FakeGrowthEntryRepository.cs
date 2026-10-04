using Nala.Core.Entries;
using Nala.Core.GrowthEntries;

namespace Nala.Tests.Support;

public class FakeGrowthEntryRepository : IGrowthEntryRepository
{
    public List<GrowthEntry> GrowthEntries { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    public Task AddAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default)
    {
        GrowthEntries.Add(growthEntry);
        return Task.CompletedTask;
    }

    public Task<GrowthEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(GrowthEntries.SingleOrDefault(g => g.Id == id));

    public Task<GrowthEntryDetails?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(GrowthEntries.Where(g => g.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default)
    {
        GrowthEntries.Remove(growthEntry);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<GrowthEntryDetails>> ListAsync(Guid babyId, GrowthEntryCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<GrowthEntryDetails>>(Newest(babyId)
            .Where(g => after is null || Compare(g, after) < 0)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    public Task<GrowthLatest> LatestAsync(Guid babyId, CancellationToken cancellationToken = default)
    {
        var entries = Newest(babyId).ToList();
        return Task.FromResult(new GrowthLatest(
            entries.Where(g => g.WeightG is not null).Select(g => new LatestMeasure(g.WeightG!.Value, g.Date, false)).FirstOrDefault(),
            entries.Where(g => g.LengthCm is not null).Select(g => new LatestMeasure(g.LengthCm!.Value, g.Date, false)).FirstOrDefault(),
            entries.Where(g => g.HeadCircumferenceCm is not null).Select(g => new LatestMeasure(g.HeadCircumferenceCm!.Value, g.Date, false)).FirstOrDefault()));
    }

    private IEnumerable<GrowthEntry> Newest(Guid babyId) => GrowthEntries
        .Where(g => g.BabyId == babyId)
        .OrderByDescending(g => g.Date)
        .ThenByDescending(g => g.CreatedAt)
        .ThenByDescending(g => g.Id);

    private static int Compare(GrowthEntry entry, GrowthEntryCursor cursor)
    {
        var byDate = entry.Date.CompareTo(cursor.Date);
        if (byDate != 0)
        {
            return byDate;
        }

        var byCreation = entry.CreatedAt.CompareTo(cursor.CreatedAt);
        return byCreation != 0 ? byCreation : entry.Id.CompareTo(cursor.Id);
    }

    private GrowthEntryDetails ToEntry(GrowthEntry growthEntry) =>
        new(growthEntry, new UserName(growthEntry.LoggedByUserId, Names[growthEntry.LoggedByUserId]), new UserName(growthEntry.UpdatedByUserId, Names[growthEntry.UpdatedByUserId]));
}
