using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Core.Auth;

public sealed record RegisterCommand(string? Token, string? Email, string? DisplayName, string? Password, string? Language);

public abstract record InvitationLookup
{
    public sealed record Valid(InvitationKind Kind, string InvitedBy, string? FamilyName, DateTimeOffset ExpiresAt) : InvitationLookup;

    public sealed record Unavailable(InvitationProblem Problem) : InvitationLookup;
}

public abstract record AcceptResult
{
    public sealed record Accepted(Guid FamilyId) : AcceptResult;

    /// <summary>The caller is already in the invitation's family; the invitation stays unused.</summary>
    public sealed record AlreadyMember : AcceptResult;

    public sealed record Unavailable(InvitationProblem Problem) : AcceptResult;
}

public abstract record RegisterResult
{
    public sealed record Registered(User User) : RegisterResult;

    public sealed record Unavailable(InvitationProblem Problem) : RegisterResult;

    /// <summary>Field name → error code: those of <see cref="AccountFields"/>, plus <c>email: taken</c>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : RegisterResult;
}

/// <summary>
/// Turns an invitation link into an account, a member of the invitation's family, or into a membership of an existing
/// account. There is no other way to sign up once the instance is set up.
/// </summary>
public class RegistrationService(
    IInvitationRepository invitations, IUserRepository users, IFamilyRepository families, IPasswordHasher hasher, TimeProvider time)
{
    private static readonly IReadOnlyDictionary<string, string> EmailTaken = new Dictionary<string, string> { ["email"] = "taken" };

    public async Task<InvitationLookup> LookupAsync(string? token, CancellationToken cancellationToken = default)
    {
        var (invitation, problem) = await FindUsableAsync(token, cancellationToken);
        if (invitation is null)
        {
            return new InvitationLookup.Unavailable(problem!.Value);
        }

        // Users are never hard-deleted, and a deleted account keeps its display name.
        var inviter = await users.GetByIdAsync(invitation.CreatedByUserId, cancellationToken);
        var family = invitation.FamilyId is { } familyId ? await families.GetAsync(familyId, cancellationToken) : null;
        return new InvitationLookup.Valid(invitation.Kind, inviter!.DisplayName, family?.Name, invitation.ExpiresAt);
    }

    /// <summary>The invitation is checked before the fields, so an unusable link never tells whether an email has an account.</summary>
    public async Task<RegisterResult> RegisterAsync(RegisterCommand command, CancellationToken cancellationToken = default)
    {
        var (invitation, problem) = await FindUsableAsync(command.Token, cancellationToken);
        if (invitation is null)
        {
            return new RegisterResult.Unavailable(problem!.Value);
        }

        var errors = AccountFields.Validate(command.Email, command.DisplayName, command.Password);
        if (errors.Count > 0)
        {
            return new RegisterResult.Invalid(errors);
        }

        EmailAddress.TryNormalize(command.Email, out var email);
        DisplayName.TryNormalize(command.DisplayName, out var displayName);
        if (await users.GetByEmailAsync(email, cancellationToken) is not null)
        {
            return new RegisterResult.Invalid(EmailTaken);
        }

        var now = time.GetUtcNow();
        var member = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = displayName,
            PasswordHash = hasher.Hash(command.Password!),
            PreferredLanguage = Language.OrDefault(command.Language),
            CreatedAt = now,
        };

        try
        {
            // Another registration may have used the link since it was read.
            var membership = invitation.FamilyId is { } familyId
                ? new Membership { FamilyId = familyId, UserId = member.Id, Role = FamilyRole.Member, JoinedAt = now }
                : null;
            return await invitations.RedeemAsync(invitation.Id, member, membership, now, cancellationToken)
                ? new RegisterResult.Registered(member)
                : new RegisterResult.Unavailable(InvitationProblem.Used);
        }
        catch (UserConflictException)
        {
            return new RegisterResult.Invalid(EmailTaken);
        }
    }

    /// <summary>
    /// Accepts a join invitation with the signed-in account: the caller becomes a member of its family. Someone already in
    /// it is refused and the invitation stays unused. New-family invitations are not accepted yet (spec 03 slice 16).
    /// </summary>
    public async Task<AcceptResult> AcceptAsync(User actor, string? token, CancellationToken cancellationToken = default)
    {
        var (invitation, problem) = await FindUsableAsync(token, cancellationToken);
        if (invitation is null)
        {
            return new AcceptResult.Unavailable(problem!.Value);
        }

        if (invitation.FamilyId is not { } familyId)
        {
            return new AcceptResult.Unavailable(InvitationProblem.Unknown);
        }

        if (await families.GetRoleAsync(familyId, actor.Id, cancellationToken) is not null)
        {
            return new AcceptResult.AlreadyMember();
        }

        var now = time.GetUtcNow();
        var membership = new Membership { FamilyId = familyId, UserId = actor.Id, Role = FamilyRole.Member, JoinedAt = now };
        try
        {
            // Another acceptance or registration may have used the link since it was read.
            return await invitations.AcceptAsync(invitation.Id, membership, now, cancellationToken)
                ? new AcceptResult.Accepted(familyId)
                : new AcceptResult.Unavailable(InvitationProblem.Used);
        }
        catch (MembershipConflictException)
        {
            return new AcceptResult.AlreadyMember();
        }
    }

    private async Task<(Invitation? Invitation, InvitationProblem? Problem)> FindUsableAsync(
        string? token, CancellationToken cancellationToken)
    {
        var invitation = string.IsNullOrEmpty(token)
            ? null
            : await invitations.GetByTokenHashAsync(LinkToken.Hash(token), cancellationToken);
        if (invitation is null)
        {
            return (null, InvitationProblem.Unknown);
        }

        var problem = invitation.ProblemAt(time.GetUtcNow());
        return problem is null ? (invitation, null) : (null, problem);
    }
}
