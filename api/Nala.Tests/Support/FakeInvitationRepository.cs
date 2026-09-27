using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Tests.Support;

/// <summary>Redeeming adds the user to the given user repository, like the real transaction.</summary>
public class FakeInvitationRepository(FakeUserRepository users) : IInvitationRepository
{
    public List<Invitation> Invitations { get; } = [];

    /// <summary>Simulates another registration consuming the invitation first.</summary>
    public bool ConsumedConcurrently { get; set; }

    public Task AddAsync(Invitation invitation, CancellationToken cancellationToken = default)
    {
        Invitations.Add(invitation);
        return Task.CompletedTask;
    }

    public Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        Task.FromResult(Invitations.SingleOrDefault(i => i.TokenHash == tokenHash));

    public async Task<bool> RedeemAsync(Guid invitationId, User user, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var invitation = Invitations.Single(i => i.Id == invitationId);
        if (ConsumedConcurrently || invitation.ProblemAt(now) is not null)
        {
            return false;
        }

        if (users.Users.Any(u => u.Email == user.Email && u.DeletedAt is null))
        {
            throw new UserConflictException();
        }

        await users.AddAsync(user, cancellationToken);
        invitation.UsedAt = now;
        invitation.UsedByUserId = user.Id;
        return true;
    }
}
