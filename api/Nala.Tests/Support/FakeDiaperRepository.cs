using Nala.Core.Diapers;
using Nala.Core.Entries;

namespace Nala.Tests.Support;

public class FakeDiaperRepository : IDiaperRepository
{
    public List<Diaper> Diapers { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    public Task AddAsync(Diaper diaper, CancellationToken cancellationToken = default)
    {
        Diapers.Add(diaper);
        return Task.CompletedTask;
    }

    public Task<Diaper?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Diapers.SingleOrDefault(d => d.Id == id));

    public Task<DiaperEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Diapers.Where(d => d.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(Diaper diaper, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(Diaper diaper, CancellationToken cancellationToken = default)
    {
        Diapers.Remove(diaper);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<DiaperEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<DiaperEntry>>(Diapers
            .Where(d => d.BabyId == babyId)
            .Where(d => after is null || d.Time < after.StartTime || (d.Time == after.StartTime && d.Id.CompareTo(after.Id) < 0))
            .OrderByDescending(d => d.Time)
            .ThenByDescending(d => d.Id)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    private DiaperEntry ToEntry(Diaper diaper) =>
        new(diaper, new UserName(diaper.LoggedByUserId, Names[diaper.LoggedByUserId]), new UserName(diaper.UpdatedByUserId, Names[diaper.UpdatedByUserId]));
}
