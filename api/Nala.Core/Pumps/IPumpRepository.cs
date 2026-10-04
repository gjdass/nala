using Nala.Core.Entries;

namespace Nala.Core.Pumps;

public interface IPumpRepository
{
    Task AddAsync(Pump pump, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<Pump?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<PumpEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(Pump pump, CancellationToken cancellationToken = default);

    Task DeleteAsync(Pump pump, CancellationToken cancellationToken = default);

    /// <summary>The baby's sessions, newest first (start time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<PumpEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);
}
