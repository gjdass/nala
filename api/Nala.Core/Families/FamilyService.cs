using Nala.Core.Users;

namespace Nala.Core.Families;

public abstract record RenameFamilyResult
{
    public sealed record Renamed(UserFamily Family) : RenameFamilyResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record NotFound : RenameFamilyResult;

    /// <summary>The caller is a member, not the family admin.</summary>
    public sealed record Forbidden : RenameFamilyResult;

    /// <summary>Field name → error code, see <see cref="FamilyName.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : RenameFamilyResult;
}

/// <summary>The families a user belongs to. Only the family admin renames one.</summary>
public class FamilyService(IFamilyRepository families, FamilyAccess access)
{
    /// <summary>By name (case-insensitive), then by creation.</summary>
    public async Task<IReadOnlyList<UserFamily>> ListAsync(User user, CancellationToken cancellationToken = default) =>
        FamilyOrder.ByName(await families.ListForUserAsync(user.Id, cancellationToken));

    /// <summary>Family check first, then the role, then the name (field <c>name</c>).</summary>
    public async Task<RenameFamilyResult> RenameAsync(User actor, Guid familyId, string? name, CancellationToken cancellationToken = default)
    {
        if (await access.RoleInAsync(actor, familyId, cancellationToken) is not { } role)
        {
            return new RenameFamilyResult.NotFound();
        }

        if (role != FamilyRole.Admin)
        {
            return new RenameFamilyResult.Forbidden();
        }

        if (FamilyName.Validate(name, out var normalized) is { } code)
        {
            return new RenameFamilyResult.Invalid(new Dictionary<string, string> { ["name"] = code });
        }

        // Null only if the family went away since the check: answered like any unknown family.
        return await families.RenameAsync(familyId, normalized, cancellationToken) is { } family
            ? new RenameFamilyResult.Renamed(new UserFamily(family, role))
            : new RenameFamilyResult.NotFound();
    }

    /// <summary>
    /// The family something new the user creates goes to, until the API is told which one (spec 03 slice 13):
    /// their first family. Null when they are in none.
    /// </summary>
    public static async Task<Guid?> FirstFamilyIdAsync(IFamilyRepository families, User user, CancellationToken cancellationToken) =>
        FamilyOrder.ByName(await families.ListForUserAsync(user.Id, cancellationToken)).FirstOrDefault()?.Family.Id;
}
