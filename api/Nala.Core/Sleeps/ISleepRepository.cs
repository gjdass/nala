using Nala.Core.Entries;

namespace Nala.Core.Sleeps;

public interface ISleepRepository
{
    Task AddAsync(Sleep sleep, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<Sleep?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<SleepEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(Sleep sleep, CancellationToken cancellationToken = default);

    Task DeleteAsync(Sleep sleep, CancellationToken cancellationToken = default);

    /// <summary>The baby's sleeps, newest first (start time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<SleepEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);
}
