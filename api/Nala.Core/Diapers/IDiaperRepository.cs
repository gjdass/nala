using Nala.Core.Entries;

namespace Nala.Core.Diapers;

public interface IDiaperRepository
{
    Task AddAsync(Diaper diaper, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<Diaper?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<DiaperEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(Diaper diaper, CancellationToken cancellationToken = default);

    Task DeleteAsync(Diaper diaper, CancellationToken cancellationToken = default);

    /// <summary>The baby's diapers, newest first (time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<DiaperEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);
}
