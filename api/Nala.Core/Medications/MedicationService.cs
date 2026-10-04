using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Users;

namespace Nala.Core.Medications;

public abstract record CreateMedicationResult
{
    public sealed record Created(MedicationEntry Entry) : CreateMedicationResult;

    /// <summary>A medication with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(MedicationEntry Entry) : CreateMedicationResult;

    public sealed record BabyNotFound : CreateMedicationResult;

    /// <summary>Field name → error code, see <see cref="MedicationFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateMedicationResult;
}

public abstract record UpdateMedicationResult
{
    public sealed record Updated(MedicationEntry Entry) : UpdateMedicationResult;

    public sealed record NotFound : UpdateMedicationResult;

    /// <summary>Field name → error code, see <see cref="MedicationFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateMedicationResult;
}

public abstract record DeleteMedicationResult
{
    public sealed record Deleted : DeleteMedicationResult;

    public sealed record NotFound : DeleteMedicationResult;
}

public abstract record ListMedicationsResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<MedicationEntry> Entries, string? Next) : ListMedicationsResult;

    public sealed record BabyNotFound : ListMedicationsResult;

    public sealed record InvalidCursor : ListMedicationsResult;
}

/// <summary>A baby's medication doses (spec 09). Any member can add, edit and delete any dose.</summary>
public class MedicationService(IMedicationRepository medications, IBabyRepository babies, TimeProvider time)
{
    /// <summary>
    /// Adds a medication under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored medication unchanged, whatever the body.
    /// </summary>
    public async Task<CreateMedicationResult> CreateAsync(User actor, Guid id, Guid babyId, MedicationInput input, CancellationToken cancellationToken = default)
    {
        if (await medications.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return new CreateMedicationResult.AlreadyExists(existing);
        }

        var now = time.GetUtcNow();
        var errors = MedicationFields.Validate(input, now);
        if (errors.Count > 0)
        {
            return new CreateMedicationResult.Invalid(errors);
        }

        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new CreateMedicationResult.BabyNotFound();
        }

        var medication = new Medication { Id = id, BabyId = babyId, LoggedByUserId = actor.Id, CreatedAt = now };
        Apply(medication, input, actor, now);
        await medications.AddAsync(medication, cancellationToken);
        return new CreateMedicationResult.Created((await medications.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>Replaces every field; the baby never changes.</summary>
    public async Task<UpdateMedicationResult> UpdateAsync(User actor, Guid id, MedicationInput input, CancellationToken cancellationToken = default)
    {
        var medication = await medications.GetAsync(id, cancellationToken);
        if (medication is null)
        {
            return new UpdateMedicationResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = MedicationFields.Validate(input, now);
        if (errors.Count > 0)
        {
            return new UpdateMedicationResult.Invalid(errors);
        }

        Apply(medication, input, actor, now);
        await medications.UpdateAsync(medication, cancellationToken);
        return new UpdateMedicationResult.Updated((await medications.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>The medication with who logged and last edited it; null when unknown.</summary>
    public Task<MedicationEntry?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        medications.GetEntryAsync(id, cancellationToken);

    public async Task<DeleteMedicationResult> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var medication = await medications.GetAsync(id, cancellationToken);
        if (medication is null)
        {
            return new DeleteMedicationResult.NotFound();
        }

        await medications.DeleteAsync(medication, cancellationToken);
        return new DeleteMedicationResult.Deleted();
    }

    /// <summary>One page of the baby's medications, newest first (see <see cref="EntryPaging"/>).</summary>
    public async Task<ListMedicationsResult> ListAsync(Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        EntryCursor? after = null;
        if (cursor is not null && (after = EntryCursor.TryDecode(cursor)) is null)
        {
            return new ListMedicationsResult.InvalidCursor();
        }

        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new ListMedicationsResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);
        var (page, next) = EntryPaging.Split(
            await medications.ListAsync(babyId, after, size + 1, cancellationToken), size, e => new EntryCursor(e.Medication.Time, e.Medication.Id));
        return new ListMedicationsResult.Page(page, next);
    }

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Medication medication, MedicationInput input, User actor, DateTimeOffset now)
    {
        medication.Time = input.Time!.Value;
        medication.Name = input.Name!.Trim();
        medication.Amount = input.Amount;
        medication.Unit = input.Amount is null ? null : MedicationFields.ParseUnit(input.Unit);
        medication.Notes = EntryFields.NormalizeText(input.Notes);
        medication.UpdatedByUserId = actor.Id;
        medication.UpdatedAt = now;
    }
}
