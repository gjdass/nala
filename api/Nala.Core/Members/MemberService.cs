using Nala.Core.Users;

namespace Nala.Core.Members;

/// <summary>The family's members as every member sees them. Removing one is the admin disable (<see cref="Admin.AdminService"/>).</summary>
public class MemberService(IUserRepository users)
{
    /// <summary>Enabled, non-deleted users, the admin first, then by display name.</summary>
    public async Task<IReadOnlyList<User>> ListAsync(CancellationToken cancellationToken = default) =>
        UserOrder.AdminFirstThenByName((await users.ListActiveAsync(cancellationToken)).Where(u => !u.IsDisabled));
}
