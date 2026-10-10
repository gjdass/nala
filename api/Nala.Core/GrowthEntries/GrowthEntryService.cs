using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.GrowthEntries;

public abstract record CreateGrowthEntryResult
{
    public sealed record Created(GrowthEntryDetails Entry) : CreateGrowthEntryResult;

    /// <summary>A growth entry with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(GrowthEntryDetails Entry) : CreateGrowthEntryResult;

    /// <summary>The id belongs to an entry of a baby outside the caller's families: it is left unchanged.</summary>
    public sealed record NotFound : CreateGrowthEntryResult;

    public sealed record BabyNotFound : CreateGrowthEntryResult;

    /// <summary>Field name → error code, see <see cref="GrowthEntryFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateGrowthEntryResult;
}

public abstract record UpdateGrowthEntryResult
{
    public sealed record Updated(GrowthEntryDetails Entry) : UpdateGrowthEntryResult;

    public sealed record NotFound : UpdateGrowthEntryResult;

    /// <summary>Field name → error code, see <see cref="GrowthEntryFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateGrowthEntryResult;
}

public abstract record DeleteGrowthEntryResult
{
    public sealed record Deleted : DeleteGrowthEntryResult;

    public sealed record NotFound : DeleteGrowthEntryResult;
}

public abstract record ListGrowthEntriesResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<GrowthEntryDetails> Entries, string? Next) : ListGrowthEntriesResult;

    public sealed record BabyNotFound : ListGrowthEntriesResult;

    public sealed record InvalidCursor : ListGrowthEntriesResult;
}

public abstract record LatestGrowthResult
{
    public sealed record Found(GrowthLatest Latest) : LatestGrowthResult;

    public sealed record BabyNotFound : LatestGrowthResult;
}

/// <summary>A baby's growth entries (spec 10). Any member of the baby's family can add, edit and delete any entry; outside the caller's families, babies and entries answer as unknown (<see cref="FamilyAccess"/>).</summary>
public class GrowthEntryService(IGrowthEntryRepository growthEntries, FamilyAccess access, TimeProvider time)
{
    /// <summary>
    /// Adds a growth entry under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored entry unchanged, whatever the body.
    /// </summary>
    public async Task<CreateGrowthEntryResult> CreateAsync(
        User actor, Guid id, Guid babyId, string? kind, GrowthEntryInput input, CancellationToken cancellationToken = default)
    {
        if (await growthEntries.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return await access.ReachesBabyAsync(actor, existing.GrowthEntry.BabyId, cancellationToken)
                ? new CreateGrowthEntryResult.AlreadyExists(existing)
                : new CreateGrowthEntryResult.NotFound();
        }

        var kindErrors = GrowthEntryFields.ValidateKind(kind);
        if (kindErrors.Count > 0)
        {
            return new CreateGrowthEntryResult.Invalid(kindErrors);
        }

        // The date is checked against the baby's birth date, so the baby is needed first.
        if (await access.ForBabyAsync(actor, babyId, cancellationToken) is not { Baby: var baby })
        {
            return new CreateGrowthEntryResult.BabyNotFound();
        }

        var growthKind = GrowthEntryFields.ParseKind(kind!);
        var now = time.GetUtcNow();
        var errors = GrowthEntryFields.Validate(growthKind, input, baby.BirthDate);
        if (errors.Count > 0)
        {
            return new CreateGrowthEntryResult.Invalid(errors);
        }

        var growthEntry = new GrowthEntry { Id = id, BabyId = babyId, Kind = growthKind, LoggedByUserId = actor.Id, CreatedAt = now };
        Apply(growthEntry, input, actor, now);
        await growthEntries.AddAsync(growthEntry, cancellationToken);
        return new CreateGrowthEntryResult.Created((await growthEntries.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>Replaces every field of the entry's kind; the baby and the kind never change.</summary>
    public async Task<UpdateGrowthEntryResult> UpdateAsync(User actor, Guid id, GrowthEntryInput input, CancellationToken cancellationToken = default)
    {
        var growthEntry = await growthEntries.GetAsync(id, cancellationToken);
        if (growthEntry is null || await access.ForBabyAsync(actor, growthEntry.BabyId, cancellationToken) is not { Baby: var baby })
        {
            return new UpdateGrowthEntryResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = GrowthEntryFields.Validate(growthEntry.Kind, input, baby.BirthDate);
        if (errors.Count > 0)
        {
            return new UpdateGrowthEntryResult.Invalid(errors);
        }

        Apply(growthEntry, input, actor, now);
        await growthEntries.UpdateAsync(growthEntry, cancellationToken);
        return new UpdateGrowthEntryResult.Updated((await growthEntries.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>The growth entry with who logged and last edited it; null when unknown or outside the caller's families.</summary>
    public async Task<GrowthEntryDetails?> GetAsync(User user, Guid id, CancellationToken cancellationToken = default) =>
        await growthEntries.GetEntryAsync(id, cancellationToken) is { } entry && await access.ReachesBabyAsync(user, entry.GrowthEntry.BabyId, cancellationToken)
            ? entry
            : null;

    public async Task<DeleteGrowthEntryResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        var growthEntry = await growthEntries.GetAsync(id, cancellationToken);
        if (growthEntry is null || !await access.ReachesBabyAsync(actor, growthEntry.BabyId, cancellationToken))
        {
            return new DeleteGrowthEntryResult.NotFound();
        }

        await growthEntries.DeleteAsync(growthEntry, cancellationToken);
        return new DeleteGrowthEntryResult.Deleted();
    }

    /// <summary>One page of the baby's growth entries, newest date first, then newest created (see <see cref="EntryPaging"/>).</summary>
    public async Task<ListGrowthEntriesResult> ListAsync(User user, Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        GrowthEntryCursor? after = null;
        if (cursor is not null && (after = GrowthEntryCursor.TryDecode(cursor)) is null)
        {
            return new ListGrowthEntriesResult.InvalidCursor();
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new ListGrowthEntriesResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);
        var (page, next) = EntryPaging.Split(
            await growthEntries.ListAsync(babyId, after, size + 1, cancellationToken),
            size,
            e => new GrowthEntryCursor(e.GrowthEntry.Date, e.GrowthEntry.CreatedAt, e.GrowthEntry.Id).Encode());
        return new ListGrowthEntriesResult.Page(page, next);
    }

    /// <summary>
    /// Each measure from the baby's most recent entry that has it, else from its birth fields (dated with the birth date,
    /// <see cref="LatestMeasure.Birth"/> true), else null.
    /// </summary>
    public async Task<LatestGrowthResult> LatestAsync(User user, Guid babyId, CancellationToken cancellationToken = default)
    {
        if (await access.ForBabyAsync(user, babyId, cancellationToken) is not { Baby: var baby })
        {
            return new LatestGrowthResult.BabyNotFound();
        }

        var latest = await growthEntries.LatestAsync(babyId, cancellationToken);
        return new LatestGrowthResult.Found(new GrowthLatest(
            latest.Weight ?? AtBirth(baby, baby.BirthWeightG),
            latest.Length ?? AtBirth(baby, baby.BirthLengthCm),
            latest.HeadCircumference ?? AtBirth(baby, baby.BirthHeadCircumferenceCm)));
    }

    private static LatestMeasure? AtBirth(Baby baby, decimal? value) =>
        value is { } v ? new LatestMeasure(v, baby.BirthDate, Birth: true) : null;

    /// <summary>Call only on validated input. The other kind's fields stay null, as does a preset milestone's title.</summary>
    private static void Apply(GrowthEntry growthEntry, GrowthEntryInput input, User actor, DateTimeOffset now)
    {
        var measurement = growthEntry.Kind == GrowthKind.Measurement;
        GrowthMilestone? milestone = measurement ? null : GrowthEntryFields.ParseMilestone(input.Milestone!);
        growthEntry.Date = input.Date!.Value;
        growthEntry.WeightG = measurement && input.WeightG is { } weight ? (int)weight : null;
        growthEntry.LengthCm = measurement ? input.LengthCm : null;
        growthEntry.HeadCircumferenceCm = measurement ? input.HeadCircumferenceCm : null;
        growthEntry.Milestone = milestone;
        growthEntry.Title = milestone == GrowthMilestone.Custom ? EntryFields.NormalizeText(input.Title) : null;
        growthEntry.Notes = EntryFields.NormalizeText(input.Notes);
        growthEntry.UpdatedByUserId = actor.Id;
        growthEntry.UpdatedAt = now;
    }
}
