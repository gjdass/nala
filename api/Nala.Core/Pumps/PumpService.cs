using Nala.Core.Entries;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Pumps;

public abstract record CreatePumpResult
{
    public sealed record Created(PumpEntry Entry) : CreatePumpResult;

    /// <summary>A session with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(PumpEntry Entry) : CreatePumpResult;

    /// <summary>The id belongs to an entry of a baby outside the caller's families: it is left unchanged.</summary>
    public sealed record NotFound : CreatePumpResult;

    public sealed record BabyNotFound : CreatePumpResult;

    /// <summary>Field name → error code, see <see cref="PumpFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreatePumpResult;
}

public abstract record UpdatePumpResult
{
    public sealed record Updated(PumpEntry Entry) : UpdatePumpResult;

    public sealed record NotFound : UpdatePumpResult;

    /// <summary>Field name → error code, see <see cref="PumpFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdatePumpResult;
}

public abstract record DeletePumpResult
{
    public sealed record Deleted : DeletePumpResult;

    public sealed record NotFound : DeletePumpResult;
}

public abstract record ListPumpsResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<PumpEntry> Entries, string? Next) : ListPumpsResult;

    public sealed record BabyNotFound : ListPumpsResult;

    public sealed record InvalidCursor : ListPumpsResult;
}

/// <summary>
/// A baby's pumping sessions (spec 08), each with a single Start / Stop timer (one live session per baby). Any member of the baby's
/// family can add, edit and delete any session; outside the caller's families, babies and sessions answer as unknown
/// (<see cref="FamilyAccess"/>).
/// </summary>
public class PumpService(IPumpRepository pumps, FamilyAccess access, TimeProvider time)
{
    private readonly EntryTimer<Pump, PumpEntry> _timer = new(
        pumps,
        access,
        time,
        e => e.Pump,
        n => new Pump { Id = n.Id, BabyId = n.BabyId, StartTime = n.StartTime, LoggedByUserId = n.LoggedByUserId, CreatedAt = n.CreatedAt });

    /// <summary>
    /// Adds a session under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored session unchanged, whatever the body.
    /// </summary>
    public async Task<CreatePumpResult> CreateAsync(User actor, Guid id, Guid babyId, PumpInput input, CancellationToken cancellationToken = default)
    {
        if (await pumps.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return await access.ReachesBabyAsync(actor, existing.Pump.BabyId, cancellationToken)
                ? new CreatePumpResult.AlreadyExists(existing)
                : new CreatePumpResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = PumpFields.Validate(input);
        if (errors.Count > 0)
        {
            return new CreatePumpResult.Invalid(errors);
        }

        if (!await access.ReachesBabyAsync(actor, babyId, cancellationToken))
        {
            return new CreatePumpResult.BabyNotFound();
        }

        var pump = new Pump { Id = id, BabyId = babyId, LoggedByUserId = actor.Id, CreatedAt = now };
        Apply(pump, input, actor, now);
        await pumps.AddAsync(pump, cancellationToken);
        return new CreatePumpResult.Created((await pumps.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>
    /// Replaces the start time, end time, volumes and notes; the baby never changes. A live session stays live: it takes no
    /// end time (Save never stops a timer, spec 04).
    /// </summary>
    public async Task<UpdatePumpResult> UpdateAsync(User actor, Guid id, PumpInput input, CancellationToken cancellationToken = default)
    {
        var pump = await pumps.GetAsync(id, cancellationToken);
        if (pump is null || !await access.ReachesBabyAsync(actor, pump.BabyId, cancellationToken))
        {
            return new UpdatePumpResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = PumpFields.Validate(input, live: pump.EndTime is null);
        if (errors.Count > 0)
        {
            return new UpdatePumpResult.Invalid(errors);
        }

        Apply(pump, input, actor, now);
        await pumps.UpdateAsync(pump, cancellationToken);
        return new UpdatePumpResult.Updated((await pumps.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>The session with who logged and last edited it; null when unknown or outside the caller's families.</summary>
    public async Task<PumpEntry?> GetAsync(User user, Guid id, CancellationToken cancellationToken = default) =>
        await pumps.GetEntryAsync(id, cancellationToken) is { } entry && await access.ReachesBabyAsync(user, entry.Pump.BabyId, cancellationToken)
            ? entry
            : null;

    public async Task<DeletePumpResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        var pump = await pumps.GetAsync(id, cancellationToken);
        if (pump is null || !await access.ReachesBabyAsync(actor, pump.BabyId, cancellationToken))
        {
            return new DeletePumpResult.NotFound();
        }

        await pumps.DeleteAsync(pump, cancellationToken);
        return new DeletePumpResult.Deleted();
    }

    /// <summary>One page of the baby's sessions, newest first (see <see cref="EntryPaging"/>).</summary>
    public async Task<ListPumpsResult> ListAsync(User user, Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        EntryCursor? after = null;
        if (cursor is not null && (after = EntryCursor.TryDecode(cursor)) is null)
        {
            return new ListPumpsResult.InvalidCursor();
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new ListPumpsResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);
        var (page, next) = EntryPaging.Split(
            await pumps.ListAsync(babyId, after, size + 1, cancellationToken), size, e => new EntryCursor(e.Pump.StartTime, e.Pump.Id));
        return new ListPumpsResult.Page(page, next);
    }

    /// <summary>Starts the session's timer (see <see cref="EntryTimer{T, TEntry}.StartAsync"/>).</summary>
    public Task<TimerResult<PumpEntry>> StartAsync(
        User actor, Guid id, Guid babyId, DateTimeOffset? at, bool queued = false, CancellationToken cancellationToken = default) =>
        _timer.StartAsync(actor, id, babyId, at, queued, cancellationToken);

    /// <summary>Stops the session's timer (see <see cref="EntryTimer{T, TEntry}.StopAsync"/>).</summary>
    public Task<TimerResult<PumpEntry>> StopAsync(User actor, Guid id, DateTimeOffset? at, CancellationToken cancellationToken = default) =>
        _timer.StopAsync(actor, id, at, cancellationToken);

    /// <summary>The live sessions of the babies of the caller's families, oldest start first.</summary>
    public Task<IReadOnlyList<PumpEntry>> ListLiveAsync(User user, CancellationToken cancellationToken = default) =>
        _timer.ListLiveAsync(user, cancellationToken);

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Pump pump, PumpInput input, User actor, DateTimeOffset now)
    {
        pump.StartTime = input.StartTime!.Value;
        pump.EndTime = input.EndTime;
        pump.LeftMl = (int?)input.LeftMl;
        pump.RightMl = (int?)input.RightMl;
        pump.Notes = EntryFields.NormalizeText(input.Notes);
        pump.UpdatedByUserId = actor.Id;
        pump.UpdatedAt = now;
    }
}
