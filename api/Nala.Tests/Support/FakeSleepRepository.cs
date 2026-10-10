using Nala.Core.Entries;
using Nala.Core.Sleeps;

namespace Nala.Tests.Support;

public class FakeSleepRepository : ISleepRepository
{
    public List<Sleep> Sleeps { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    public Task AddAsync(Sleep sleep, CancellationToken cancellationToken = default)
    {
        Sleeps.Add(sleep);
        return Task.CompletedTask;
    }

    public Task<Sleep?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Sleeps.SingleOrDefault(s => s.Id == id));

    public Task<SleepEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Sleeps.Where(s => s.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(Sleep sleep, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(Sleep sleep, CancellationToken cancellationToken = default)
    {
        Sleeps.Remove(sleep);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SleepEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SleepEntry>>(Sleeps
            .Where(s => s.BabyId == babyId)
            .Where(s => after is null || s.StartTime < after.StartTime || (s.StartTime == after.StartTime && s.Id.CompareTo(after.Id) < 0))
            .OrderByDescending(s => s.StartTime)
            .ThenByDescending(s => s.Id)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    public Task<SleepEntry?> GetLiveAsync(Guid babyId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Live().Where(s => s.BabyId == babyId).Select(ToEntry).FirstOrDefault());

    public Task<IReadOnlyList<SleepEntry>> ListLiveAsync(IReadOnlyCollection<Guid> babyIds, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SleepEntry>>(Live().Where(s => babyIds.Contains(s.BabyId)).Select(ToEntry).ToList());

    private IEnumerable<Sleep> Live() => Sleeps.Where(s => s.EndTime is null).OrderBy(s => s.StartTime).ThenBy(s => s.Id);

    private SleepEntry ToEntry(Sleep sleep) =>
        new(sleep, new UserName(sleep.LoggedByUserId, Names[sleep.LoggedByUserId]), new UserName(sleep.UpdatedByUserId, Names[sleep.UpdatedByUserId]));
}
