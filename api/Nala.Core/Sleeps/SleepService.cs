using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Users;

namespace Nala.Core.Sleeps;

public abstract record CreateSleepResult
{
    public sealed record Created(SleepEntry Entry) : CreateSleepResult;

    /// <summary>A sleep with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(SleepEntry Entry) : CreateSleepResult;

    public sealed record BabyNotFound : CreateSleepResult;

    /// <summary>Field name → error code, see <see cref="SleepFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateSleepResult;
}

public abstract record UpdateSleepResult
{
    public sealed record Updated(SleepEntry Entry) : UpdateSleepResult;

    public sealed record NotFound : UpdateSleepResult;

    /// <summary>Field name → error code, see <see cref="SleepFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateSleepResult;
}

public abstract record DeleteSleepResult
{
    public sealed record Deleted : DeleteSleepResult;

    public sealed record NotFound : DeleteSleepResult;
}

public abstract record ListSleepsResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<SleepEntry> Entries, string? Next) : ListSleepsResult;

    public sealed record BabyNotFound : ListSleepsResult;

    public sealed record InvalidCursor : ListSleepsResult;
}

/// <summary>The outcome of a Start or Stop tap.</summary>
public abstract record SleepTimerResult
{
    public sealed record Created(SleepEntry Entry) : SleepTimerResult;

    public sealed record Updated(SleepEntry Entry) : SleepTimerResult;

    public sealed record NotFound : SleepTimerResult;

    public sealed record BabyNotFound : SleepTimerResult;

    /// <summary>Another sleep of the baby is live (spec 06: at most one, except a start queued offline).</summary>
    public sealed record InProgressExists : SleepTimerResult;

    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : SleepTimerResult;
}

/// <summary>A baby's sleeps (spec 06). Any member can add, edit and delete any sleep.</summary>
public class SleepService(ISleepRepository sleeps, IBabyRepository babies, TimeProvider time)
{
    /// <summary>
    /// Adds a sleep under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored sleep unchanged, whatever the body.
    /// </summary>
    public async Task<CreateSleepResult> CreateAsync(User actor, Guid id, Guid babyId, SleepInput input, CancellationToken cancellationToken = default)
    {
        if (await sleeps.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return new CreateSleepResult.AlreadyExists(existing);
        }

        var now = time.GetUtcNow();
        var errors = SleepFields.Validate(input, now);
        if (errors.Count > 0)
        {
            return new CreateSleepResult.Invalid(errors);
        }

        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new CreateSleepResult.BabyNotFound();
        }

        var sleep = new Sleep { Id = id, BabyId = babyId, LoggedByUserId = actor.Id, CreatedAt = now };
        Apply(sleep, input, actor, now);
        await sleeps.AddAsync(sleep, cancellationToken);
        return new CreateSleepResult.Created((await sleeps.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>
    /// Replaces the start time, end time and notes; the baby never changes. A live sleep stays live: it takes no end time
    /// (Save never stops a timer, spec 04).
    /// </summary>
    public async Task<UpdateSleepResult> UpdateAsync(User actor, Guid id, SleepInput input, CancellationToken cancellationToken = default)
    {
        var sleep = await sleeps.GetAsync(id, cancellationToken);
        if (sleep is null)
        {
            return new UpdateSleepResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = SleepFields.Validate(input, now, live: sleep.EndTime is null);
        if (errors.Count > 0)
        {
            return new UpdateSleepResult.Invalid(errors);
        }

        Apply(sleep, input, actor, now);
        await sleeps.UpdateAsync(sleep, cancellationToken);
        return new UpdateSleepResult.Updated((await sleeps.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>The sleep with who logged and last edited it; null when unknown.</summary>
    public Task<SleepEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        sleeps.GetEntryAsync(id, cancellationToken);

    public async Task<DeleteSleepResult> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var sleep = await sleeps.GetAsync(id, cancellationToken);
        if (sleep is null)
        {
            return new DeleteSleepResult.NotFound();
        }

        await sleeps.DeleteAsync(sleep, cancellationToken);
        return new DeleteSleepResult.Deleted();
    }

    /// <summary>One page of the baby's sleeps, newest first (see <see cref="EntryPaging"/>).</summary>
    public async Task<ListSleepsResult> ListAsync(Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        EntryCursor? after = null;
        if (cursor is not null && (after = EntryCursor.TryDecode(cursor)) is null)
        {
            return new ListSleepsResult.InvalidCursor();
        }

        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new ListSleepsResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);
        var (page, next) = EntryPaging.Split(
            await sleeps.ListAsync(babyId, after, size + 1, cancellationToken), size, e => new EntryCursor(e.Sleep.StartTime, e.Sleep.Id));
        return new ListSleepsResult.Page(page, next);
    }

    /// <summary>
    /// Starts the timer of the sleep <paramref name="id"/> at <paramref name="at"/>: an unknown sleep is created live (start
    /// time = <paramref name="at"/>); a stopped one becomes live again (its end time is cleared, so its duration runs from its
    /// start time again); a live one is unchanged. Making a sleep live is refused while another sleep of the baby is live,
    /// unless the start was <paramref name="queued"/> offline: it is then kept as a separate sleep, so nothing logged
    /// offline is lost.
    /// </summary>
    public async Task<SleepTimerResult> StartAsync(
        User actor, Guid id, Guid babyId, DateTimeOffset? at, bool queued = false, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = SleepFields.ValidateTimerAt(at, now);
        if (errors.Count > 0)
        {
            return new SleepTimerResult.Invalid(errors);
        }

        var sleep = await sleeps.GetAsync(id, cancellationToken);
        if (sleep is null && await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new SleepTimerResult.BabyNotFound();
        }

        if (sleep is { EndTime: null })
        {
            return await UpdatedAsync(sleep, cancellationToken);
        }

        if (!queued
            && await sleeps.GetLiveAsync(sleep?.BabyId ?? babyId, cancellationToken) is { } live
            && live.Sleep.Id != id)
        {
            return new SleepTimerResult.InProgressExists();
        }

        var startAt = at!.Value;
        if (sleep is not null)
        {
            if (startAt < sleep.StartTime)
            {
                return new SleepTimerResult.Invalid(new Dictionary<string, string> { ["at"] = "invalid" });
            }

            sleep.EndTime = null;
            Touch(sleep, actor, now);
            await sleeps.UpdateAsync(sleep, cancellationToken);
            return await UpdatedAsync(sleep, cancellationToken);
        }

        sleep = new Sleep { Id = id, BabyId = babyId, StartTime = startAt, LoggedByUserId = actor.Id, CreatedAt = now };
        Touch(sleep, actor, now);
        await sleeps.AddAsync(sleep, cancellationToken);
        return new SleepTimerResult.Created((await sleeps.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>
    /// Stops the live sleep at <paramref name="at"/>, which becomes its end time: it is no longer live (spec 04 Timers). A
    /// stopped sleep is unchanged.
    /// </summary>
    public async Task<SleepTimerResult> StopAsync(User actor, Guid id, DateTimeOffset? at, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = SleepFields.ValidateTimerAt(at, now);
        if (errors.Count > 0)
        {
            return new SleepTimerResult.Invalid(errors);
        }

        if (await sleeps.GetAsync(id, cancellationToken) is not { } sleep)
        {
            return new SleepTimerResult.NotFound();
        }

        if (sleep.EndTime is not null)
        {
            return await UpdatedAsync(sleep, cancellationToken);
        }

        if (at < sleep.StartTime)
        {
            return new SleepTimerResult.Invalid(new Dictionary<string, string> { ["at"] = "invalid" });
        }

        sleep.EndTime = at;
        Touch(sleep, actor, now);
        await sleeps.UpdateAsync(sleep, cancellationToken);
        return await UpdatedAsync(sleep, cancellationToken);
    }

    /// <summary>Every live sleep, of every baby (one instance is one family), oldest start first.</summary>
    public Task<IReadOnlyList<SleepEntry>> ListLiveAsync(CancellationToken cancellationToken = default) =>
        sleeps.ListLiveAsync(cancellationToken);

    private async Task<SleepTimerResult> UpdatedAsync(Sleep sleep, CancellationToken cancellationToken) =>
        new SleepTimerResult.Updated((await sleeps.GetEntryAsync(sleep.Id, cancellationToken))!);

    private static void Touch(Sleep sleep, User actor, DateTimeOffset now)
    {
        sleep.UpdatedByUserId = actor.Id;
        sleep.UpdatedAt = now;
    }

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Sleep sleep, SleepInput input, User actor, DateTimeOffset now)
    {
        sleep.StartTime = input.StartTime!.Value;
        sleep.EndTime = input.EndTime;
        sleep.Notes = EntryFields.NormalizeText(input.Notes);
        Touch(sleep, actor, now);
    }
}
