using Nala.Core.Users;

namespace Nala.Core.Families;

/// <summary>The families a user belongs to.</summary>
public class FamilyService(IFamilyRepository families)
{
    /// <summary>By name (case-insensitive), then by creation.</summary>
    public async Task<IReadOnlyList<UserFamily>> ListAsync(User user, CancellationToken cancellationToken = default) =>
        FamilyOrder.ByName(await families.ListForUserAsync(user.Id, cancellationToken));

    /// <summary>
    /// The family something new the user creates goes to, until the API is told which one (spec 03 slices 9 and 13):
    /// their first family. Null when they are in none.
    /// </summary>
    public static async Task<Guid?> FirstFamilyIdAsync(IFamilyRepository families, User user, CancellationToken cancellationToken) =>
        FamilyOrder.ByName(await families.ListForUserAsync(user.Id, cancellationToken)).FirstOrDefault()?.Family.Id;
}
