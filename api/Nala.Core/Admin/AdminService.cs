using Nala.Core.Users;

namespace Nala.Core.Admin;

public abstract record ListUsersResult
{
    /// <summary>The admin first, then by display name.</summary>
    public sealed record Listed(IReadOnlyList<User> Users) : ListUsersResult;

    public sealed record Forbidden : ListUsersResult;
}

/// <summary>Admin-only management of the instance's users. Every call is refused to anyone but the admin.</summary>
public class AdminService(IUserRepository users)
{
    /// <summary>Every non-deleted user, whatever their families. Carries no family data.</summary>
    public async Task<ListUsersResult> ListUsersAsync(User actor, CancellationToken cancellationToken = default)
    {
        if (!actor.IsAdmin)
        {
            return new ListUsersResult.Forbidden();
        }

        var list = await users.ListActiveAsync(cancellationToken);
        return new ListUsersResult.Listed(UserOrder.AdminFirstThenByName(list));
    }
}
