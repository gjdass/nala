using Nala.Core.Entries;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Diapers;

public abstract record CreateDiaperResult
{
    public sealed record Created(DiaperEntry Entry) : CreateDiaperResult;

    /// <summary>A diaper with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(DiaperEntry Entry) : CreateDiaperResult;

    /// <summary>The id belongs to an entry of a baby outside the caller's families: it is left unchanged.</summary>
    public sealed record NotFound : CreateDiaperResult;

    public sealed record BabyNotFound : CreateDiaperResult;

    /// <summary>Field name → error code, see <see cref="DiaperFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateDiaperResult;
}

public abstract record UpdateDiaperResult
{
    public sealed record Updated(DiaperEntry Entry) : UpdateDiaperResult;

    public sealed record NotFound : UpdateDiaperResult;

    /// <summary>Field name → error code, see <see cref="DiaperFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateDiaperResult;
}

public abstract record DeleteDiaperResult
{
    public sealed record Deleted : DeleteDiaperResult;

    public sealed record NotFound : DeleteDiaperResult;
}

public abstract record ListDiapersResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<DiaperEntry> Entries, string? Next) : ListDiapersResult;

    public sealed record BabyNotFound : ListDiapersResult;

    public sealed record InvalidCursor : ListDiapersResult;
}

/// <summary>A baby's diapers (spec 07). Any member of the baby's family can add, edit and delete any diaper; outside the caller's families, babies and entries answer as unknown (<see cref="FamilyAccess"/>).</summary>
public class DiaperService(IDiaperRepository diapers, FamilyAccess access, TimeProvider time)
{
    /// <summary>
    /// Adds a diaper under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored diaper unchanged, whatever the body.
    /// </summary>
    public async Task<CreateDiaperResult> CreateAsync(User actor, Guid id, Guid babyId, DiaperInput input, CancellationToken cancellationToken = default)
    {
        if (await diapers.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return await access.ReachesBabyAsync(actor, existing.Diaper.BabyId, cancellationToken)
                ? new CreateDiaperResult.AlreadyExists(existing)
                : new CreateDiaperResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = DiaperFields.Validate(input);
        if (errors.Count > 0)
        {
            return new CreateDiaperResult.Invalid(errors);
        }

        if (!await access.ReachesBabyAsync(actor, babyId, cancellationToken))
        {
            return new CreateDiaperResult.BabyNotFound();
        }

        var diaper = new Diaper { Id = id, BabyId = babyId, LoggedByUserId = actor.Id, CreatedAt = now };
        Apply(diaper, input, actor, now);
        await diapers.AddAsync(diaper, cancellationToken);
        return new CreateDiaperResult.Created((await diapers.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>Replaces every field; the baby never changes.</summary>
    public async Task<UpdateDiaperResult> UpdateAsync(User actor, Guid id, DiaperInput input, CancellationToken cancellationToken = default)
    {
        var diaper = await diapers.GetAsync(id, cancellationToken);
        if (diaper is null || !await access.ReachesBabyAsync(actor, diaper.BabyId, cancellationToken))
        {
            return new UpdateDiaperResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = DiaperFields.Validate(input);
        if (errors.Count > 0)
        {
            return new UpdateDiaperResult.Invalid(errors);
        }

        Apply(diaper, input, actor, now);
        await diapers.UpdateAsync(diaper, cancellationToken);
        return new UpdateDiaperResult.Updated((await diapers.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>The diaper with who logged and last edited it; null when unknown or outside the caller's families.</summary>
    public async Task<DiaperEntry?> GetAsync(User user, Guid id, CancellationToken cancellationToken = default) =>
        await diapers.GetEntryAsync(id, cancellationToken) is { } entry && await access.ReachesBabyAsync(user, entry.Diaper.BabyId, cancellationToken)
            ? entry
            : null;

    public async Task<DeleteDiaperResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        var diaper = await diapers.GetAsync(id, cancellationToken);
        if (diaper is null || !await access.ReachesBabyAsync(actor, diaper.BabyId, cancellationToken))
        {
            return new DeleteDiaperResult.NotFound();
        }

        await diapers.DeleteAsync(diaper, cancellationToken);
        return new DeleteDiaperResult.Deleted();
    }

    /// <summary>One page of the baby's diapers, newest first (see <see cref="EntryPaging"/>).</summary>
    public async Task<ListDiapersResult> ListAsync(User user, Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        EntryCursor? after = null;
        if (cursor is not null && (after = EntryCursor.TryDecode(cursor)) is null)
        {
            return new ListDiapersResult.InvalidCursor();
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new ListDiapersResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);
        var (page, next) = EntryPaging.Split(
            await diapers.ListAsync(babyId, after, size + 1, cancellationToken), size, e => new EntryCursor(e.Diaper.Time, e.Diaper.Id));
        return new ListDiapersResult.Page(page, next);
    }

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Diaper diaper, DiaperInput input, User actor, DateTimeOffset now)
    {
        diaper.Time = input.Time!.Value;
        diaper.Wet = input.Wet;
        diaper.Dirty = input.Dirty;
        diaper.Rash = input.Rash;
        diaper.Color = input.Dirty ? DiaperFields.ParseColor(input.Color) : null;
        diaper.Consistency = input.Dirty ? DiaperFields.ParseConsistency(input.Consistency) : null;
        diaper.Notes = EntryFields.NormalizeText(input.Notes);
        diaper.UpdatedByUserId = actor.Id;
        diaper.UpdatedAt = now;
    }
}
