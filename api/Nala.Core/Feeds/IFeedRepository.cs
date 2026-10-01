using Nala.Core.Entries;

namespace Nala.Core.Feeds;

public interface IFeedRepository
{
    Task AddAsync(Feed feed, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<Feed?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<FeedEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(Feed feed, CancellationToken cancellationToken = default);

    Task DeleteAsync(Feed feed, CancellationToken cancellationToken = default);

    /// <summary>The baby's feeds, live ones included, newest first (start time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<FeedEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);

    Task<BottleDefaults> GetBottleDefaultsAsync(Guid babyId, CancellationToken cancellationToken = default);

    /// <summary>The baby's live breastfeed (no end; the oldest when a queued one made two), with its segments; null when none.</summary>
    Task<FeedEntry?> GetInProgressBreastfeedAsync(Guid babyId, CancellationToken cancellationToken = default);

    /// <summary>The side of the last segment of the baby's latest breastfeed that isn't live; null when none.</summary>
    Task<BreastSide?> GetLastBreastSideAsync(Guid babyId, CancellationToken cancellationToken = default);

    /// <summary>Every live breastfeed (no end), of every baby, with its segments; oldest start first.</summary>
    Task<IReadOnlyList<FeedEntry>> ListInProgressBreastfeedsAsync(CancellationToken cancellationToken = default);
}
