using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Core.Admin;

public abstract record ListUsersResult
{
    /// <summary>The admin first, then by display name.</summary>
    public sealed record Listed(IReadOnlyList<User> Users) : ListUsersResult;

    public sealed record Forbidden : ListUsersResult;
}

public abstract record SetDisabledResult
{
    public sealed record Updated(User User) : SetDisabledResult;

    public sealed record Forbidden : SetDisabledResult;

    /// <summary>Unknown or deleted user.</summary>
    public sealed record NotFound : SetDisabledResult;

    /// <summary>The target is the admin, who is the only one allowed to call this.</summary>
    public sealed record AdminCannotDisable : SetDisabledResult;
}

/// <summary>Admin-only management of the instance's users. Every call is refused to anyone but the admin.</summary>
public class AdminService(IUserRepository users, ISessionRepository sessions, IInvitationRepository invitations, TimeProvider time)
{
    /// <summary>Non-deleted users, disabled ones included.</summary>
    public async Task<ListUsersResult> ListUsersAsync(User actor, CancellationToken cancellationToken = default)
    {
        if (!actor.IsAdmin)
        {
            return new ListUsersResult.Forbidden();
        }

        var list = await users.ListActiveAsync(cancellationToken);
        return new ListUsersResult.Listed(UserOrder.AdminFirstThenByName(list));
    }

    /// <summary>
    /// Disabling ends every session of the user, blocks their login and revokes their pending invitations; re-enabling
    /// restores the login. Removing a member (03) is this same action.
    /// </summary>
    public async Task<SetDisabledResult> SetDisabledAsync(
        User actor, Guid userId, bool disabled, CancellationToken cancellationToken = default)
    {
        if (!actor.IsAdmin)
        {
            return new SetDisabledResult.Forbidden();
        }

        var user = await users.GetByIdAsync(userId, cancellationToken);
        if (user is not { DeletedAt: null })
        {
            return new SetDisabledResult.NotFound();
        }

        if (user.IsAdmin)
        {
            return new SetDisabledResult.AdminCannotDisable();
        }

        user.IsDisabled = disabled;
        await users.UpdateAsync(user, cancellationToken);
        if (disabled)
        {
            await sessions.DeleteAllAsync(user.Id, cancellationToken);
            await invitations.RevokePendingAsync(user.Id, time.GetUtcNow(), cancellationToken);
        }

        return new SetDisabledResult.Updated(user);
    }
}
