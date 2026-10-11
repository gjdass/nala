using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Tests.Support;

/// <summary>
/// Redeeming adds the user to the given user repository, like the real transaction; accepting adds the membership to the
/// given family repository. A family created by either goes to the family repository.
/// </summary>
public class FakeInvitationRepository(FakeUserRepository users, FakeFamilyRepository? families = null) : IInvitationRepository
{
    public List<Invitation> Invitations { get; } = [];

    /// <summary>The memberships saved by redeeming.</summary>
    public List<Membership> Memberships { get; } = [];

    /// <summary>Simulates another registration consuming the invitation first.</summary>
    public bool ConsumedConcurrently { get; set; }

    public Task AddAsync(Invitation invitation, CancellationToken cancellationToken = default)
    {
        Invitations.Add(invitation);
        return Task.CompletedTask;
    }

    public Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        Task.FromResult(Invitations.SingleOrDefault(i => i.TokenHash == tokenHash));

    public async Task<bool> RedeemAsync(
        Guid invitationId,
        User user,
        Family? family,
        Membership? membership,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
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
        if (family is not null)
        {
            families?.Families.Add(family);
        }

        if (membership is not null)
        {
            Memberships.Add(membership);
        }

        return true;
    }

    /// <summary>Simulates the user joining the family by another way between the service's check and the save.</summary>
    public bool MembershipConflict { get; set; }

    public Task<bool> AcceptAsync(
        Guid invitationId, Family? family, Membership membership, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var invitation = Invitations.Single(i => i.Id == invitationId);
        if (ConsumedConcurrently || invitation.ProblemAt(now) is not null)
        {
            return Task.FromResult(false);
        }

        var memberships = families?.Memberships ?? Memberships;
        if (MembershipConflict || memberships.Any(m => m.FamilyId == membership.FamilyId && m.UserId == membership.UserId))
        {
            throw new MembershipConflictException();
        }

        if (family is not null)
        {
            families?.Families.Add(family);
        }

        memberships.Add(membership);
        invitation.UsedAt = now;
        invitation.UsedByUserId = membership.UserId;
        return Task.FromResult(true);
    }

    /// <summary>Simulates a registration using the invitation between the service reading it and revoking it.</summary>
    public bool UsedBeforeRevoke { get; set; }

    public Task<Invitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Invitations.SingleOrDefault(i => i.Id == id));

    public Task<IReadOnlyList<Invitation>> ListPendingAsync(
        Guid? familyId, DateTimeOffset now, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Invitation>>(
            Invitations.Where(i => i.FamilyId == familyId && i.ProblemAt(now) is null).ToList());

    public Task<bool> RevokeAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var invitation = Invitations.Single(i => i.Id == id);
        if (UsedBeforeRevoke)
        {
            invitation.UsedAt = now;
        }

        if (invitation.ProblemAt(now) is not null)
        {
            return Task.FromResult(false);
        }

        invitation.RevokedAt = now;
        return Task.FromResult(true);
    }

    public Task RevokePendingAsync(Guid createdByUserId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        foreach (var invitation in Invitations.Where(i => i.CreatedByUserId == createdByUserId && i.ProblemAt(now) is null))
        {
            invitation.RevokedAt = now;
        }

        return Task.CompletedTask;
    }
}
