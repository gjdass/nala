namespace Nala.Core.Entries;

/// <summary>
/// The storage a section with a timer gives <see cref="EntryTimer{T, TEntry}"/>: <typeparamref name="T"/> is its entity,
/// <typeparamref name="TEntry"/> the entity with who logged and last updated it.
/// </summary>
public interface ITimedEntryRepository<T, TEntry>
    where T : class, ITimedEntry
    where TEntry : class
{
    Task AddAsync(T entry, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<T?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<TEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(T entry, CancellationToken cancellationToken = default);

    /// <summary>The baby's live entry (no end time); the oldest one when several are live; null when none.</summary>
    Task<TEntry?> GetLiveAsync(Guid babyId, CancellationToken cancellationToken = default);

    /// <summary>The live entries of the given babies, oldest start first.</summary>
    Task<IReadOnlyList<TEntry>> ListLiveAsync(IReadOnlyCollection<Guid> babyIds, CancellationToken cancellationToken = default);
}
