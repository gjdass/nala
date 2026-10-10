using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Babies;

public abstract record CreateBabyResult
{
    public sealed record Created(Baby Baby) : CreateBabyResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record FamilyNotFound : CreateBabyResult;

    /// <summary>Field name → error code, see <see cref="BabyFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateBabyResult;
}

public abstract record UpdateBabyResult
{
    public sealed record Updated(Baby Baby) : UpdateBabyResult;

    public sealed record NotFound : UpdateBabyResult;

    /// <summary>Field name → error code, see <see cref="BabyFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateBabyResult;
}

public abstract record DeleteBabyResult
{
    public sealed record Deleted : DeleteBabyResult;

    public sealed record Forbidden : DeleteBabyResult;

    public sealed record NotFound : DeleteBabyResult;
}

/// <summary>
/// The babies of the caller's families (checked through <see cref="FamilyAccess"/>). Every member can list, add and edit
/// them; only the family admin can delete one. A baby never changes family.
/// </summary>
public class BabyService(IBabyRepository babies, FamilyAccess access, TimeProvider time)
{
    /// <summary>A family the caller isn't in is not found, before the fields; a missing one is a <c>familyId</c> field error.</summary>
    public async Task<CreateBabyResult> CreateAsync(User actor, Guid? familyId, BabyInput input, CancellationToken cancellationToken = default)
    {
        if (familyId is { } id && await access.RoleInAsync(actor, id, cancellationToken) is null)
        {
            return new CreateBabyResult.FamilyNotFound();
        }

        var now = time.GetUtcNow();
        var errors = BabyFields.Validate(input, now);
        if (familyId is null)
        {
            errors["familyId"] = "required";
        }

        if (errors.Count > 0)
        {
            return new CreateBabyResult.Invalid(errors);
        }

        var baby = new Baby
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId!.Value,
            Name = string.Empty,
            CreatedByUserId = actor.Id,
            CreatedAt = now,
        };
        Apply(baby, input, now);
        await babies.AddAsync(baby, cancellationToken);
        return new CreateBabyResult.Created(baby);
    }

    /// <summary>Replaces every field: an omitted sex or measurement is cleared. Any member may edit any baby of their families.</summary>
    public async Task<UpdateBabyResult> UpdateAsync(User actor, Guid id, BabyInput input, CancellationToken cancellationToken = default)
    {
        if (await access.ForBabyAsync(actor, id, cancellationToken) is not { Baby: var baby })
        {
            return new UpdateBabyResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = BabyFields.Validate(input, now);
        if (errors.Count > 0)
        {
            return new UpdateBabyResult.Invalid(errors);
        }

        Apply(baby, input, now);
        await babies.UpdateAsync(baby, cancellationToken);
        return new UpdateBabyResult.Updated(baby);
    }

    /// <summary>Family admin only, checked after the family check. The baby's entries go with it (database cascade).</summary>
    public async Task<DeleteBabyResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        if (await access.ForBabyAsync(actor, id, cancellationToken) is not { } found)
        {
            return new DeleteBabyResult.NotFound();
        }

        if (found.Role != FamilyRole.Admin)
        {
            return new DeleteBabyResult.Forbidden();
        }

        await babies.DeleteAsync(found.Baby, cancellationToken);
        return new DeleteBabyResult.Deleted();
    }

    /// <summary>The babies of every family of the caller, oldest first.</summary>
    public Task<IReadOnlyList<Baby>> ListAsync(User user, CancellationToken cancellationToken = default) =>
        babies.ListForUserAsync(user.Id, cancellationToken);

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Baby baby, BabyInput input, DateTimeOffset now)
    {
        baby.Name = BabyFields.NormalizeName(input.Name);
        baby.BirthDate = input.BirthDate!.Value;
        baby.Sex = BabyFields.ParseSex(input.Sex);
        baby.BirthWeightG = (int?)input.BirthWeightG;
        baby.BirthLengthCm = input.BirthLengthCm;
        baby.BirthHeadCircumferenceCm = input.BirthHeadCircumferenceCm;
        baby.UpdatedAt = now;
    }
}
