using Nala.Core.Babies;
using Nala.Core.Users;

namespace Nala.Core.Families;

/// <summary>A baby as one of its family's members reaches it: with their role in that family.</summary>
public sealed record BabyAccess(Baby Baby, FamilyRole Role);

/// <summary>
/// The one family check (spec 03): resolves a family or a baby to the caller's membership. Null means the caller isn't in
/// that family, answered exactly as an unknown id, before any role check. The instance admin gets nothing more.
/// </summary>
public class FamilyAccess(IFamilyRepository families, IBabyRepository babies)
{
    /// <summary>The caller's role in the family; null when they aren't in it or it doesn't exist.</summary>
    public Task<FamilyRole?> RoleInAsync(User user, Guid familyId, CancellationToken cancellationToken = default) =>
        families.GetRoleAsync(familyId, user.Id, cancellationToken);

    /// <summary>The baby (tracked) with the caller's role in its family; null for an unknown baby or another family's.</summary>
    public async Task<BabyAccess?> ForBabyAsync(User user, Guid babyId, CancellationToken cancellationToken = default)
    {
        if (await babies.GetAsync(babyId, cancellationToken) is not { } baby)
        {
            return null;
        }

        return await families.GetRoleAsync(baby.FamilyId, user.Id, cancellationToken) is { } role
            ? new BabyAccess(baby, role)
            : null;
    }
}
