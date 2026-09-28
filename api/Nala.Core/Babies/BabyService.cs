using Nala.Core.Users;

namespace Nala.Core.Babies;

public abstract record CreateBabyResult
{
    public sealed record Created(Baby Baby) : CreateBabyResult;

    /// <summary>Field name → error code, see <see cref="BabyFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateBabyResult;
}

/// <summary>The family's babies. Every member can list and add them.</summary>
public class BabyService(IBabyRepository babies, TimeProvider time)
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
            Name = BabyFields.NormalizeName(input.Name),
            BirthDate = input.BirthDate!.Value,
            Sex = BabyFields.ParseSex(input.Sex),
            BirthWeightG = (int?)input.BirthWeightG,
            BirthLengthCm = input.BirthLengthCm,
            BirthHeadCircumferenceCm = input.BirthHeadCircumferenceCm,
            CreatedByUserId = actor.Id,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await babies.AddAsync(baby, cancellationToken);
        return new CreateBabyResult.Created(baby);
    }

    /// <summary>Oldest first.</summary>
    public Task<IReadOnlyList<Baby>> ListAsync(CancellationToken cancellationToken = default) =>
        babies.ListAsync(cancellationToken);
}
