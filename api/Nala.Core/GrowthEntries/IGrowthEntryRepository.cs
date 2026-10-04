namespace Nala.Core.GrowthEntries;

public interface IGrowthEntryRepository
{
    Task AddAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<GrowthEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<GrowthEntryDetails?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default);

    Task DeleteAsync(GrowthEntry growthEntry, CancellationToken cancellationToken = default);

    /// <summary>
    /// The baby's growth entries, newest first (date, then creation time, then id, all descending), after
    /// <paramref name="after"/> when given.
    /// </summary>
    Task<IReadOnlyList<GrowthEntryDetails>> ListAsync(Guid babyId, GrowthEntryCursor? after, int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// Each measure from the baby's most recent entry that has it (date, then creation time, then id), never from the birth
    /// fields (<see cref="LatestMeasure.Birth"/> false); null when no entry has it.
    /// </summary>
    Task<GrowthLatest> LatestAsync(Guid babyId, CancellationToken cancellationToken = default);
}
