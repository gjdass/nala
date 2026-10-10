using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Babies;

public abstract record CreateBabyResult
{
    public sealed record Created(Baby Baby) : CreateBabyResult;

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

/// <summary>The family's babies. Every member can list, add and edit them; only the admin can delete one.</summary>
public class BabyService(IBabyRepository babies, IFamilyRepository families, TimeProvider time)
{
    public async Task<CreateBabyResult> CreateAsync(User actor, BabyInput input, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = BabyFields.Validate(input, now);
        if (errors.Count > 0)
        {
            return new CreateBabyResult.Invalid(errors);
        }

        var baby = new Baby
        {
            Id = Guid.NewGuid(),
            FamilyId = await FamilyService.FirstFamilyIdAsync(families, actor, cancellationToken)
                ?? throw new InvalidOperationException("The user is in no family."),
            Name = string.Empty,
            CreatedByUserId = actor.Id,
            CreatedAt = now,
        };
        Apply(baby, input, now);
        await babies.AddAsync(baby, cancellationToken);
        return new CreateBabyResult.Created(baby);
    }

    /// <summary>Replaces every field: an omitted sex or measurement is cleared. Any member may edit any baby.</summary>
    public async Task<UpdateBabyResult> UpdateAsync(User actor, Guid id, BabyInput input, CancellationToken cancellationToken = default)
    {
        var baby = await babies.GetAsync(id, cancellationToken);
        if (baby is null)
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

    /// <summary>Admin only, checked before the lookup. The baby's entries go with it (database cascade).</summary>
    public async Task<DeleteBabyResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        if (!actor.IsAdmin)
        {
            return new DeleteBabyResult.Forbidden();
        }

        var baby = await babies.GetAsync(id, cancellationToken);
        if (baby is null)
        {
            return new DeleteBabyResult.NotFound();
        }

        await babies.DeleteAsync(baby, cancellationToken);
        return new DeleteBabyResult.Deleted();
    }

    /// <summary>Oldest first.</summary>
    public Task<IReadOnlyList<Baby>> ListAsync(CancellationToken cancellationToken = default) =>
        babies.ListAsync(cancellationToken);

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
