using Nala.Core.Users;

namespace Nala.Core.Invitations;

public interface IInvitationRepository
{
    Task AddAsync(Invitation invitation, CancellationToken cancellationToken = default);

    Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically saves the new user and marks the invitation used by them, if it is still usable at <paramref name="now"/>.
    /// False when it is not (nothing is saved). Throws <see cref="UserConflictException"/> when the email is taken.
    /// </summary>
    Task<bool> RedeemAsync(Guid invitationId, User user, DateTimeOffset now, CancellationToken cancellationToken = default);
}
