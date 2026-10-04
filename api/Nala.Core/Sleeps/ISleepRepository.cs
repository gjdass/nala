using Nala.Core.Entries;

namespace Nala.Core.Sleeps;

public interface ISleepRepository : ITimedEntryRepository<Sleep, SleepEntry>
{
    Task DeleteAsync(Sleep sleep, CancellationToken cancellationToken = default);

    /// <summary>The baby's sleeps, newest first (start time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<SleepEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);
}
