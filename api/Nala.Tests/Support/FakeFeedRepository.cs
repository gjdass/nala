using Nala.Core.Feeds;

namespace Nala.Tests.Support;

public class FakeFeedRepository : IFeedRepository
{
    public List<Feed> Feeds { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    public Task AddAsync(Feed feed, CancellationToken cancellationToken = default)
    {
        Feeds.Add(feed);
        return Task.CompletedTask;
    }

    public Task<Feed?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Feeds.SingleOrDefault(f => f.Id == id));

    public Task<FeedEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Feeds.Where(f => f.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(Feed feed, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(Feed feed, CancellationToken cancellationToken = default)
    {
        Feeds.Remove(feed);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<FeedEntry>> ListAsync(Guid babyId, FeedCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<FeedEntry>>(Feeds
            .Where(f => f.BabyId == babyId)
            .Where(f => after is null || f.StartTime < after.StartTime || (f.StartTime == after.StartTime && f.Id.CompareTo(after.Id) < 0))
            .OrderByDescending(f => f.StartTime)
            .ThenByDescending(f => f.Id)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    public Task<BottleDefaults> GetBottleDefaultsAsync(Guid babyId, CancellationToken cancellationToken = default)
    {
        var bottles = Feeds.Where(f => f.BabyId == babyId && f.Kind == FeedKind.Bottle).OrderByDescending(f => f.StartTime).ToList();
        int? Last(MilkType type) => bottles.FirstOrDefault(f => f.MilkType == type)?.AmountMl;
        return Task.FromResult(new BottleDefaults(bottles.FirstOrDefault()?.MilkType, Last(MilkType.BreastMilk), Last(MilkType.Formula)));
    }

    private FeedEntry ToEntry(Feed feed) =>
        new(feed, new UserName(feed.LoggedByUserId, Names[feed.LoggedByUserId]), new UserName(feed.UpdatedByUserId, Names[feed.UpdatedByUserId]));
}
