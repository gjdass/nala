using Nala.Core.HealthEntries;
using Nala.Core.Entries;

namespace Nala.Tests.Support;

public class FakeHealthEntryRepository : IHealthEntryRepository
{
    public List<HealthEntry> HealthEntries { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    /// <summary>The limit of the last <see cref="ListRecentAsync"/> call.</summary>
    public int? LastRecentLimit { get; private set; }

    public Task AddAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default)
    {
        HealthEntries.Add(healthEntry);
        return Task.CompletedTask;
    }

    public Task<HealthEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(HealthEntries.SingleOrDefault(m => m.Id == id));

    public Task<HealthEntryDetails?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(HealthEntries.Where(m => m.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default)
    {
        HealthEntries.Remove(healthEntry);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<HealthEntryDetails>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<HealthEntryDetails>>(HealthEntries
            .Where(m => m.BabyId == babyId)
            .Where(m => after is null || m.Time < after.StartTime || (m.Time == after.StartTime && m.Id.CompareTo(after.Id) < 0))
            .OrderByDescending(m => m.Time)
            .ThenByDescending(m => m.Id)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    public Task<IReadOnlyList<RecentMedicine>> ListRecentAsync(Guid babyId, int limit, CancellationToken cancellationToken = default)
    {
        LastRecentLimit = limit;
        return Task.FromResult<IReadOnlyList<RecentMedicine>>(HealthEntries
            .Where(m => m.BabyId == babyId && m.Name != null)
            .OrderByDescending(m => m.Time)
            .ThenByDescending(m => m.Id)
            .DistinctBy(m => m.Name!.ToLowerInvariant())
            .Take(limit)
            .Select(m => new RecentMedicine(m.Name!, m.Amount, m.Unit))
            .ToList());
    }

    private HealthEntryDetails ToEntry(HealthEntry healthEntry) =>
        new(healthEntry, new UserName(healthEntry.LoggedByUserId, Names[healthEntry.LoggedByUserId]), new UserName(healthEntry.UpdatedByUserId, Names[healthEntry.UpdatedByUserId]));
}
