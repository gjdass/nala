using Nala.Core.Entries;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.HealthEntries;

public abstract record CreateHealthEntryResult
{
    public sealed record Created(HealthEntryDetails Entry) : CreateHealthEntryResult;

    /// <summary>A health entry with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(HealthEntryDetails Entry) : CreateHealthEntryResult;

    /// <summary>The id belongs to an entry of a baby outside the caller's families: it is left unchanged.</summary>
    public sealed record NotFound : CreateHealthEntryResult;

    public sealed record BabyNotFound : CreateHealthEntryResult;

    /// <summary>Field name → error code, see <see cref="HealthEntryFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateHealthEntryResult;
}

public abstract record UpdateHealthEntryResult
{
    public sealed record Updated(HealthEntryDetails Entry) : UpdateHealthEntryResult;

    public sealed record NotFound : UpdateHealthEntryResult;

    /// <summary>Field name → error code, see <see cref="HealthEntryFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateHealthEntryResult;
}

public abstract record DeleteHealthEntryResult
{
    public sealed record Deleted : DeleteHealthEntryResult;

    public sealed record NotFound : DeleteHealthEntryResult;
}

public abstract record ListHealthEntriesResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<HealthEntryDetails> Entries, string? Next) : ListHealthEntriesResult;

    public sealed record BabyNotFound : ListHealthEntriesResult;

    public sealed record InvalidCursor : ListHealthEntriesResult;
}

public abstract record RecentMedicinesResult
{
    public sealed record Found(IReadOnlyList<RecentMedicine> HealthEntries) : RecentMedicinesResult;

    public sealed record BabyNotFound : RecentMedicinesResult;
}

/// <summary>A baby's health entries (spec 09). Any member of the baby's family can add, edit and delete any dose; outside the caller's families, babies and entries answer as unknown (<see cref="FamilyAccess"/>).</summary>
public class HealthEntryService(IHealthEntryRepository healthEntries, FamilyAccess access, TimeProvider time)
{
    /// <summary>
    /// Adds a health entry under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored health entry unchanged, whatever the body.
    /// </summary>
    public async Task<CreateHealthEntryResult> CreateAsync(User actor, Guid id, Guid babyId, HealthEntryInput input, CancellationToken cancellationToken = default)
    {
        if (await healthEntries.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return await access.ReachesBabyAsync(actor, existing.HealthEntry.BabyId, cancellationToken)
                ? new CreateHealthEntryResult.AlreadyExists(existing)
                : new CreateHealthEntryResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = HealthEntryFields.Validate(input);
        if (errors.Count > 0)
        {
            return new CreateHealthEntryResult.Invalid(errors);
        }

        if (!await access.ReachesBabyAsync(actor, babyId, cancellationToken))
        {
            return new CreateHealthEntryResult.BabyNotFound();
        }

        var healthEntry = new HealthEntry { Id = id, BabyId = babyId, LoggedByUserId = actor.Id, CreatedAt = now };
        Apply(healthEntry, input, actor, now);
        await healthEntries.AddAsync(healthEntry, cancellationToken);
        return new CreateHealthEntryResult.Created((await healthEntries.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>Replaces every field; the baby never changes.</summary>
    public async Task<UpdateHealthEntryResult> UpdateAsync(User actor, Guid id, HealthEntryInput input, CancellationToken cancellationToken = default)
    {
        var healthEntry = await healthEntries.GetAsync(id, cancellationToken);
        if (healthEntry is null || !await access.ReachesBabyAsync(actor, healthEntry.BabyId, cancellationToken))
        {
            return new UpdateHealthEntryResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = HealthEntryFields.Validate(input);
        if (errors.Count > 0)
        {
            return new UpdateHealthEntryResult.Invalid(errors);
        }

        Apply(healthEntry, input, actor, now);
        await healthEntries.UpdateAsync(healthEntry, cancellationToken);
        return new UpdateHealthEntryResult.Updated((await healthEntries.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>The health entry with who logged and last edited it; null when unknown or outside the caller's families.</summary>
    public async Task<HealthEntryDetails?> GetAsync(User user, Guid id, CancellationToken cancellationToken = default) =>
        await healthEntries.GetEntryAsync(id, cancellationToken) is { } entry && await access.ReachesBabyAsync(user, entry.HealthEntry.BabyId, cancellationToken)
            ? entry
            : null;

    public async Task<DeleteHealthEntryResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        var healthEntry = await healthEntries.GetAsync(id, cancellationToken);
        if (healthEntry is null || !await access.ReachesBabyAsync(actor, healthEntry.BabyId, cancellationToken))
        {
            return new DeleteHealthEntryResult.NotFound();
        }

        await healthEntries.DeleteAsync(healthEntry, cancellationToken);
        return new DeleteHealthEntryResult.Deleted();
    }

    /// <summary>One page of the baby's health entries, newest first (see <see cref="EntryPaging"/>).</summary>
    public async Task<ListHealthEntriesResult> ListAsync(User user, Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        EntryCursor? after = null;
        if (cursor is not null && (after = EntryCursor.TryDecode(cursor)) is null)
        {
            return new ListHealthEntriesResult.InvalidCursor();
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new ListHealthEntriesResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);
        var (page, next) = EntryPaging.Split(
            await healthEntries.ListAsync(babyId, after, size + 1, cancellationToken), size, e => new EntryCursor(e.HealthEntry.Time, e.HealthEntry.Id));
        return new ListHealthEntriesResult.Page(page, next);
    }

    /// <summary>How many recent names the Health sheet offers.</summary>
    public const int RecentLimit = 5;

    /// <summary>The baby's recently given names, most recent first, each with its latest dose.</summary>
    public async Task<RecentMedicinesResult> RecentAsync(User user, Guid babyId, CancellationToken cancellationToken = default) =>
        !await access.ReachesBabyAsync(user, babyId, cancellationToken)
            ? new RecentMedicinesResult.BabyNotFound()
            : new RecentMedicinesResult.Found(await healthEntries.ListRecentAsync(babyId, RecentLimit, cancellationToken));

    /// <summary>Call only on validated input.</summary>
    private static void Apply(HealthEntry healthEntry, HealthEntryInput input, User actor, DateTimeOffset now)
    {
        healthEntry.Time = input.Time!.Value;
        healthEntry.Name = EntryFields.NormalizeText(input.Name);
        healthEntry.Amount = input.Amount;
        healthEntry.Unit = input.Amount is null ? null : HealthEntryFields.ParseUnit(input.Unit);
        healthEntry.Temperature = input.Temperature;
        healthEntry.Notes = EntryFields.NormalizeText(input.Notes);
        healthEntry.UpdatedByUserId = actor.Id;
        healthEntry.UpdatedAt = now;
    }
}
