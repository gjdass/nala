using Nala.Core.Entries;

namespace Nala.Core.Pumps;

public interface IPumpRepository : ITimedEntryRepository<Pump, PumpEntry>
{
    Task DeleteAsync(Pump pump, CancellationToken cancellationToken = default);

    /// <summary>The baby's sessions, newest first (start time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<PumpEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);
}
