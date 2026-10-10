using Nala.Core.Users;

namespace Nala.Core.Families;

public interface IFamilyRepository
{
    /// <summary>
    /// Saves a new user, the family they create and their admin membership together.
    /// Throws <see cref="UserConflictException"/> when the user can't be saved (email taken, a second instance admin); nothing is saved then.
    /// </summary>
    Task AddWithNewAdminAsync(User admin, Family family, Membership membership, CancellationToken cancellationToken = default);

    /// <summary>The user's families with their role, in no particular order.</summary>
    /// <summary>The user's role in the family; null when they have no membership in it.</summary>
    Task<FamilyRole?> GetRoleAsync(Guid familyId, Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserFamily>> ListForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
