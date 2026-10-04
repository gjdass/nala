using Nala.Core.Entries;
using Nala.Core.Pumps;

namespace Nala.Tests.Support;

public class FakePumpRepository : IPumpRepository
{
    public List<Pump> Pumps { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    public Task AddAsync(Pump pump, CancellationToken cancellationToken = default)
    {
        Pumps.Add(pump);
        return Task.CompletedTask;
    }

    public Task<Pump?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Pumps.SingleOrDefault(p => p.Id == id));

    public Task<PumpEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Pumps.Where(p => p.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(Pump pump, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(Pump pump, CancellationToken cancellationToken = default)
    {
        Pumps.Remove(pump);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<PumpEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<PumpEntry>>(Pumps
            .Where(p => p.BabyId == babyId)
            .Where(p => after is null || p.StartTime < after.StartTime || (p.StartTime == after.StartTime && p.Id.CompareTo(after.Id) < 0))
            .OrderByDescending(p => p.StartTime)
            .ThenByDescending(p => p.Id)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    public Task<PumpEntry?> GetLiveAsync(Guid babyId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Live().Where(p => p.BabyId == babyId).Select(ToEntry).FirstOrDefault());

    public Task<IReadOnlyList<PumpEntry>> ListLiveAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<PumpEntry>>(Live().Select(ToEntry).ToList());

    private IEnumerable<Pump> Live() => Pumps.Where(p => p.EndTime is null).OrderBy(p => p.StartTime).ThenBy(p => p.Id);

    private PumpEntry ToEntry(Pump pump) =>
        new(pump, new UserName(pump.LoggedByUserId, Names[pump.LoggedByUserId]), new UserName(pump.UpdatedByUserId, Names[pump.UpdatedByUserId]));
}
