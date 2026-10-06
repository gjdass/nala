using Nala.Core.Babies;
using Nala.Core.Users;

namespace Nala.Core.Entries;

/// <summary>The outcome of a Start or Stop tap on an entry with a timer.</summary>
public abstract record TimerResult<TEntry>
{
    public sealed record Created(TEntry Entry) : TimerResult<TEntry>;

    public sealed record Updated(TEntry Entry) : TimerResult<TEntry>;

    public sealed record NotFound : TimerResult<TEntry>;

    public sealed record BabyNotFound : TimerResult<TEntry>;

    /// <summary>Another entry of the baby is live (at most one, except a start queued offline).</summary>
    public sealed record InProgressExists : TimerResult<TEntry>;

    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : TimerResult<TEntry>;
}

/// <summary>
/// The Start / Stop rules of every section with a single timer (spec 04 Timers: Sleep, Pump). <paramref name="entity"/> takes
/// the entity out of an entry; <paramref name="create"/> builds a new live entity.
/// </summary>
public class EntryTimer<T, TEntry>(
    ITimedEntryRepository<T, TEntry> entries,
    IBabyRepository babies,
    TimeProvider time,
    Func<TEntry, T> entity,
    Func<NewTimedEntry, T> create)
    where T : class, ITimedEntry
    where TEntry : class
{
    /// <summary>
    /// Starts the timer of the entry <paramref name="id"/> at <paramref name="at"/>: an unknown entry is created live (start
    /// time = <paramref name="at"/>); a stopped one becomes live again (its end time is cleared, so its duration runs from its
    /// start time again); a live one is unchanged. Making an entry live is refused while another entry of the baby is live,
    /// unless the start was <paramref name="queued"/> offline: it is then kept as a separate entry, so nothing logged
    /// offline is lost.
    /// </summary>
    public async Task<TimerResult<TEntry>> StartAsync(
        User actor, Guid id, Guid babyId, DateTimeOffset? at, bool queued = false, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = EntryFields.ValidateTimerAt(at);
        if (errors.Count > 0)
        {
            return new TimerResult<TEntry>.Invalid(errors);
        }

        var entry = await entries.GetAsync(id, cancellationToken);
        if (entry is null && await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new TimerResult<TEntry>.BabyNotFound();
        }

        if (entry is { EndTime: null })
        {
            return await UpdatedAsync(entry, cancellationToken);
        }

        if (!queued
            && await entries.GetLiveAsync(entry?.BabyId ?? babyId, cancellationToken) is { } live
            && entity(live).Id != id)
        {
            return new TimerResult<TEntry>.InProgressExists();
        }

        var startAt = at!.Value;
        if (entry is not null)
        {
            if (startAt < entry.StartTime)
            {
                return InvalidAt();
            }

            entry.EndTime = null;
            Touch(entry, actor, now);
            await entries.UpdateAsync(entry, cancellationToken);
            return await UpdatedAsync(entry, cancellationToken);
        }

        entry = create(new NewTimedEntry(id, babyId, startAt, actor.Id, now));
        Touch(entry, actor, now);
        await entries.AddAsync(entry, cancellationToken);
        return new TimerResult<TEntry>.Created((await entries.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>
    /// Stops the live entry at <paramref name="at"/>, which becomes its end time: it is no longer live (spec 04 Timers). A
    /// stopped entry is unchanged.
    /// </summary>
    public async Task<TimerResult<TEntry>> StopAsync(User actor, Guid id, DateTimeOffset? at, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = EntryFields.ValidateTimerAt(at);
        if (errors.Count > 0)
        {
            return new TimerResult<TEntry>.Invalid(errors);
        }

        if (await entries.GetAsync(id, cancellationToken) is not { } entry)
        {
            return new TimerResult<TEntry>.NotFound();
        }

        if (entry.EndTime is not null)
        {
            return await UpdatedAsync(entry, cancellationToken);
        }

        if (at < entry.StartTime)
        {
            return InvalidAt();
        }

        entry.EndTime = at;
        Touch(entry, actor, now);
        await entries.UpdateAsync(entry, cancellationToken);
        return await UpdatedAsync(entry, cancellationToken);
    }

    private static TimerResult<TEntry>.Invalid InvalidAt() => new(new Dictionary<string, string> { ["at"] = "invalid" });

    private async Task<TimerResult<TEntry>> UpdatedAsync(T entry, CancellationToken cancellationToken) =>
        new TimerResult<TEntry>.Updated((await entries.GetEntryAsync(entry.Id, cancellationToken))!);

    private static void Touch(T entry, User actor, DateTimeOffset now)
    {
        entry.UpdatedByUserId = actor.Id;
        entry.UpdatedAt = now;
    }
}
