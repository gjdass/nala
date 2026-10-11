using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Core.Auth;

/// <summary><c>FamilyName</c> names the family a new-family invitation creates; a join invitation ignores it.</summary>
public sealed record RegisterCommand(
    string? Token, string? Email, string? DisplayName, string? Password, string? Language, string? FamilyName = null);

public abstract record InvitationLookup
{
    public sealed record Valid(InvitationKind Kind, string InvitedBy, string? FamilyName, DateTimeOffset ExpiresAt) : InvitationLookup;

    public sealed record Unavailable(InvitationProblem Problem) : InvitationLookup;
}

public abstract record AcceptResult
{
    /// <summary>The family joined, or created by a new-family invitation.</summary>
    public sealed record Accepted(Guid FamilyId) : AcceptResult;

    /// <summary>Field name → error code (<c>familyName</c>: <c>required</c>, <c>tooLong</c>), for a new-family invitation.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : AcceptResult;

    /// <summary>The caller is already in the invitation's family; the invitation stays unused.</summary>
    public sealed record AlreadyMember : AcceptResult;

    public sealed record Unavailable(InvitationProblem Problem) : AcceptResult;
}

public abstract record RegisterResult
{
    public sealed record Registered(User User) : RegisterResult;

    public sealed record Unavailable(InvitationProblem Problem) : RegisterResult;

    /// <summary>
    /// Field name → error code: those of <see cref="AccountFields"/>, plus <c>email: taken</c>, and <c>familyName</c> for a
    /// new-family invitation.
    /// </summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : RegisterResult;
}

/// <summary>
/// Turns an invitation link into an account, or into a membership of an existing account: a member of a join invitation's
/// family, or the admin of the family a new-family invitation creates. There is no other way to sign up once the instance
/// is set up.
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
        var familyName = string.Empty;
        if (invitation.Kind == InvitationKind.NewFamily && FamilyName.Validate(command.FamilyName, out familyName) is { } familyNameError)
        {
            errors["familyName"] = familyNameError;
        }

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
            var (family, membership) = MembershipFor(invitation, member, familyName, now);
            return await invitations.RedeemAsync(invitation.Id, member, family, membership, now, cancellationToken)
                ? new RegisterResult.Registered(member)
                : new RegisterResult.Unavailable(InvitationProblem.Used);
        }
        catch (UserConflictException)
        {
            return new RegisterResult.Invalid(EmailTaken);
        }
    }

    /// <summary>
    /// Accepts an invitation with the signed-in account. A join invitation makes the caller a member of its family; someone
    /// already in it is refused and the invitation stays unused. A new-family invitation creates a family named
    /// <paramref name="familyName"/> with the caller as its admin. The invitation is checked before the family name.
    /// </summary>
    public async Task<AcceptResult> AcceptAsync(
        User actor, string? token, string? familyName = null, CancellationToken cancellationToken = default)
    {
        var (invitation, problem) = await FindUsableAsync(token, cancellationToken);
        if (invitation is null)
        {
            return new AcceptResult.Unavailable(problem!.Value);
        }

        var name = string.Empty;
        if (invitation.FamilyId is { } familyId)
        {
            if (await families.GetRoleAsync(familyId, actor.Id, cancellationToken) is not null)
            {
                return new AcceptResult.AlreadyMember();
            }
        }
        else if (FamilyName.Validate(familyName, out name) is { } code)
        {
            return new AcceptResult.Invalid(new Dictionary<string, string> { ["familyName"] = code });
        }

        var now = time.GetUtcNow();
        var (family, membership) = MembershipFor(invitation, actor, name, now);
        try
        {
            // Another acceptance or registration may have used the link since it was read.
            return await invitations.AcceptAsync(invitation.Id, family, membership, now, cancellationToken)
                ? new AcceptResult.Accepted(membership.FamilyId)
                : new AcceptResult.Unavailable(InvitationProblem.Used);
        }
        catch (MembershipConflictException)
        {
            return new AcceptResult.AlreadyMember();
        }
    }

    /// <summary>
    /// What using the invitation gives <paramref name="user"/>: a member membership of a join invitation's family, or a new
    /// family named <paramref name="familyName"/> with its admin membership.
    /// </summary>
    private static (Family? Family, Membership Membership) MembershipFor(
        Invitation invitation, User user, string familyName, DateTimeOffset now)
    {
        if (invitation.FamilyId is { } familyId)
        {
            return (null, new Membership { FamilyId = familyId, UserId = user.Id, Role = FamilyRole.Member, JoinedAt = now });
        }

        var family = new Family { Id = Guid.NewGuid(), Name = familyName, CreatedByUserId = user.Id, CreatedAt = now };
        return (family, new Membership { FamilyId = family.Id, UserId = user.Id, Role = FamilyRole.Admin, JoinedAt = now });
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
