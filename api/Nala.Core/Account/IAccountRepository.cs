using Nala.Core.Users;

namespace Nala.Core.Account;

public interface IAccountRepository
{
    /// <summary>
    /// Saves the soft-deleted <paramref name="user"/> (fields already cleared) and, in the same transaction: deletes the
    /// families they administer with all their data, ends their other memberships, revokes at <paramref name="now"/> the
    /// invitations they created that are still usable then, and deletes their sessions.
    /// </summary>
    Task DeleteAsync(User user, DateTimeOffset now, CancellationToken cancellationToken = default);
}
