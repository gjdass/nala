using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Invitations;

public interface IInvitationRepository
{
    Task AddAsync(Invitation invitation, CancellationToken cancellationToken = default);

    Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    Task<Invitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>The family's join invitations still usable at <paramref name="now"/>, in no particular order.</summary>
    Task<IReadOnlyList<Invitation>> ListPendingAsync(Guid familyId, DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>Revokes the invitation at <paramref name="now"/> if it is still usable then; false when it is not (nothing saved).</summary>
    Task<bool> RevokeAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically saves the new user, their <paramref name="membership"/> (if any) and marks the invitation used by them,
    /// if it is still usable at <paramref name="now"/>. False when it is not (nothing is saved).
    /// Throws <see cref="UserConflictException"/> when the email is taken.
    /// </summary>
    Task<bool> RedeemAsync(
        Guid invitationId, User user, Membership? membership, DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically saves the <paramref name="membership"/> of an existing user and marks the invitation used by them, if it
    /// is still usable at <paramref name="now"/>. False when it is not (nothing is saved).
    /// Throws <see cref="MembershipConflictException"/> when the user is already in that family.
    /// </summary>
    Task<bool> AcceptAsync(Guid invitationId, Membership membership, DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>Revokes, at <paramref name="now"/>, the invitations the user created that are still usable then.</summary>
    Task RevokePendingAsync(Guid createdByUserId, DateTimeOffset now, CancellationToken cancellationToken = default);
}
