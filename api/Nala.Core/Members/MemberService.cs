using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Members;

public abstract record ListMembersResult
{
    /// <summary>The family admin first, then by display name (case-insensitive).</summary>
    public sealed record Listed(IReadOnlyList<FamilyMember> Members) : ListMembersResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record NotFound : ListMembersResult;
}

public abstract record RemoveMemberResult
{
    public sealed record Removed : RemoveMemberResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record NotFound : RemoveMemberResult;

    /// <summary>The caller is a member, not the family admin.</summary>
    public sealed record Forbidden : RemoveMemberResult;

    /// <summary>The user isn't in the family (unknown, never in it, already removed or deleted).</summary>
    public sealed record UserNotFound : RemoveMemberResult;

    /// <summary>The family admin can't be removed.</summary>
    public sealed record AdminCannotRemove : RemoveMemberResult;
}

/// <summary>
/// A family's members: any member lists them, only the family admin removes one. Removing ends that membership only: the
/// account, its sessions and other families are kept, and so are the entries they logged.
/// </summary>
public class MemberService(FamilyAccess access, IFamilyRepository families, IUserRepository users, TimeProvider time)
{
    public async Task<ListMembersResult> ListAsync(User actor, Guid familyId, CancellationToken cancellationToken = default)
    {
        if (await access.RoleInAsync(actor, familyId, cancellationToken) is null)
        {
            return new ListMembersResult.NotFound();
        }

        var members = await families.ListMembersAsync(familyId, cancellationToken);
        return new ListMembersResult.Listed(members
            .OrderByDescending(m => m.Role == FamilyRole.Admin)
            .ThenBy(m => m.User.DisplayName, StringComparer.InvariantCultureIgnoreCase)
            .ToList());
    }

    /// <summary>
    /// Errors in order: family check, the caller's role, the target's membership, then the family admin themselves. Also
    /// revokes the invitations to the family the removed member created that are still pending.
    /// </summary>
    public async Task<RemoveMemberResult> RemoveAsync(User actor, Guid familyId, Guid userId, CancellationToken cancellationToken = default)
    {
        if (await access.RoleInAsync(actor, familyId, cancellationToken) is not { } role)
        {
            return new RemoveMemberResult.NotFound();
        }

        if (role != FamilyRole.Admin)
        {
            return new RemoveMemberResult.Forbidden();
        }

        if (await families.GetRoleAsync(familyId, userId, cancellationToken) is not { } targetRole
            || await users.GetByIdAsync(userId, cancellationToken) is not { DeletedAt: null })
        {
            return new RemoveMemberResult.UserNotFound();
        }

        if (targetRole == FamilyRole.Admin)
        {
            return new RemoveMemberResult.AdminCannotRemove();
        }

        // False only if the membership went away since the check: answered like anyone not in the family.
        return await families.RemoveMemberAsync(familyId, userId, time.GetUtcNow(), cancellationToken)
            ? new RemoveMemberResult.Removed()
            : new RemoveMemberResult.UserNotFound();
    }
}
