using Nala.Core.Users;

namespace Nala.Core.Families;

public interface IFamilyRepository
{
    /// <summary>
    /// Saves a new user, the family they create and their admin membership together.
    /// Throws <see cref="UserConflictException"/> when the user can't be saved (email taken, a second instance admin); nothing is saved then.
    /// </summary>
    Task AddWithNewAdminAsync(User admin, Family family, Membership membership, CancellationToken cancellationToken = default);

    /// <summary>The family; null when it is unknown.</summary>
    Task<Family?> GetAsync(Guid familyId, CancellationToken cancellationToken = default);

    /// <summary>The user's role in the family; null when they have no membership in it.</summary>
    Task<FamilyRole?> GetRoleAsync(Guid familyId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>The user's families with their role, in no particular order.</summary>
    Task<IReadOnlyList<UserFamily>> ListForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>The family's members whose account isn't deleted, with their role, in no particular order.</summary>
    Task<IReadOnlyList<FamilyMember>> ListMembersAsync(Guid familyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ends the user's membership of the family and revokes, at <paramref name="now"/>, the invitations to that family they
    /// created that are still usable then, together. False when they have no membership in it (nothing saved).
    /// </summary>
    Task<bool> RemoveMemberAsync(Guid familyId, Guid userId, DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>Saves the family's new name; null when the family is unknown.</summary>
    Task<Family?> RenameAsync(Guid familyId, string name, CancellationToken cancellationToken = default);
}
