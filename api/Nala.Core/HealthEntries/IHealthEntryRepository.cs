using Nala.Core.Entries;

namespace Nala.Core.HealthEntries;

public interface IHealthEntryRepository
{
    Task AddAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<HealthEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<HealthEntryDetails?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default);

    Task DeleteAsync(HealthEntry healthEntry, CancellationToken cancellationToken = default);

    /// <summary>The baby's health entries, newest first (time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<HealthEntryDetails>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// The baby's <paramref name="limit"/> most recently given names, distinct whatever their case, most recent first
    /// (time, then id), each with the spelling and dose of its latest entry.
    /// </summary>
    Task<IReadOnlyList<RecentMedicine>> ListRecentAsync(Guid babyId, int limit, CancellationToken cancellationToken = default);
}
