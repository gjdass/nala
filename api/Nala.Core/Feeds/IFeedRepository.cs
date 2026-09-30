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

    /// <summary>The baby's feeds newest first (start time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<FeedEntry>> ListAsync(Guid babyId, FeedCursor? after, int limit, CancellationToken cancellationToken = default);

    Task<BottleDefaults> GetBottleDefaultsAsync(Guid babyId, CancellationToken cancellationToken = default);
}
