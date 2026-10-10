using Nala.Core.Auth;
using Nala.Core.Email;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Invitations;

/// <summary>The token goes in the link <c>/invite/{token}</c>; only its hash is stored.</summary>
public sealed record CreatedInvitation(Guid Id, string Token, DateTimeOffset ExpiresAt);

/// <summary><c>CreatedBy</c> is the creator's display name.</summary>
public sealed record PendingInvitation(Guid Id, string CreatedBy, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

public abstract record CreateInvitationResult
{
    public sealed record Created(CreatedInvitation Invitation) : CreateInvitationResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record FamilyNotFound : CreateInvitationResult;
}

public abstract record RevokeInvitationResult
{
    /// <summary>Revoked now, or already revoked.</summary>
    public sealed record Revoked : RevokeInvitationResult;

    /// <summary>Unknown, or another family's invitation.</summary>
    public sealed record NotFound : RevokeInvitationResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record FamilyNotFound : RevokeInvitationResult;

    /// <summary>Used or expired: there is nothing left to revoke.</summary>
    public sealed record Unavailable(InvitationProblem Problem) : RevokeInvitationResult;
}

public abstract record SendInvitationResult
{
    public sealed record Sent(DateTimeOffset ExpiresAt) : SendInvitationResult;

    /// <summary>The family is unknown, or the caller isn't in it.</summary>
    public sealed record FamilyNotFound : SendInvitationResult;

    /// <summary>SMTP isn't configured.</summary>
    public sealed record Disabled : SendInvitationResult;

    /// <summary>Field name → error code (<c>email</c>: <c>required</c>, <c>invalid</c>, <c>alreadyMember</c>).</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : SendInvitationResult;
}

/// <summary>
/// Join invitations to a family (spec 03). Any of its members can create, list and revoke them; for anyone else the
/// family answers as unknown, through the shared family check.
/// </summary>
public class InvitationService(
    IInvitationRepository invitations,
    IUserRepository users,
    IFamilyRepository families,
    FamilyAccess access,
    IEmailOutbox outbox,
    TimeProvider time)
{
    public async Task<CreateInvitationResult> CreateAsync(User actor, Guid familyId, CancellationToken cancellationToken = default) =>
        await access.RoleInAsync(actor, familyId, cancellationToken) is null
            ? new CreateInvitationResult.FamilyNotFound()
            : new CreateInvitationResult.Created(await AddAsync(actor, familyId, cancellationToken));

    /// <summary>
    /// Creates an invitation and queues its link to <paramref name="email"/>, in the inviter's language. The address is
    /// only used for sending; a member of that family is refused, an account elsewhere is fine.
    /// <paramref name="publicUrl"/> is null when SMTP is off, checked after the family.
    /// </summary>
    public async Task<SendInvitationResult> SendByEmailAsync(
        User actor, Guid familyId, string? email, Uri? publicUrl, CancellationToken cancellationToken = default)
    {
        if (await access.RoleInAsync(actor, familyId, cancellationToken) is null)
        {
            return new SendInvitationResult.FamilyNotFound();
        }

        if (publicUrl is null)
        {
            return new SendInvitationResult.Disabled();
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            return Invalid("required");
        }

        if (!EmailAddress.TryNormalize(email, out var normalized))
        {
            return Invalid("invalid");
        }

        if (await users.GetByEmailAsync(normalized, cancellationToken) is { } user
            && await families.GetRoleAsync(familyId, user.Id, cancellationToken) is not null)
        {
            return Invalid("alreadyMember");
        }

        // Null only if the family went away since the check: answered like any unknown family.
        if (await families.GetAsync(familyId, cancellationToken) is not { } family)
        {
            return new SendInvitationResult.FamilyNotFound();
        }

        var created = await AddAsync(actor, familyId, cancellationToken);
        outbox.Enqueue(InvitationEmail.Compose(actor, family.Name, normalized, publicUrl, created.Token, created.ExpiresAt));
        return new SendInvitationResult.Sent(created.ExpiresAt);

        static SendInvitationResult.Invalid Invalid(string code) => new(new Dictionary<string, string> { ["email"] = code });
    }

    /// <summary>The family's unused, unexpired and unrevoked invitations, newest first; null when the family is unknown to the caller.</summary>
    public async Task<IReadOnlyList<PendingInvitation>?> ListPendingAsync(
        User actor, Guid familyId, CancellationToken cancellationToken = default)
    {
        if (await access.RoleInAsync(actor, familyId, cancellationToken) is null)
        {
            return null;
        }

        var pending = await invitations.ListPendingAsync(familyId, time.GetUtcNow(), cancellationToken);

        // Users are never hard-deleted, and a deleted account keeps its display name.
        var creators = new Dictionary<Guid, string>();
        foreach (var creatorId in pending.Select(i => i.CreatedByUserId).Distinct())
        {
            creators[creatorId] = (await users.GetByIdAsync(creatorId, cancellationToken))!.DisplayName;
        }

        return pending
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new PendingInvitation(i.Id, creators[i.CreatedByUserId], i.CreatedAt, i.ExpiresAt))
            .ToList();
    }

    /// <summary>Idempotent: an already revoked invitation stays as it was. Another family's invitation is unknown.</summary>
    public async Task<RevokeInvitationResult> RevokeAsync(
        User actor, Guid familyId, Guid id, CancellationToken cancellationToken = default)
    {
        if (await access.RoleInAsync(actor, familyId, cancellationToken) is null)
        {
            return new RevokeInvitationResult.FamilyNotFound();
        }

        var invitation = await invitations.GetByIdAsync(id, cancellationToken);
        if (invitation is null || invitation.FamilyId != familyId)
        {
            return new RevokeInvitationResult.NotFound();
        }

        var now = time.GetUtcNow();
        if (invitation.ProblemAt(now) is null && await invitations.RevokeAsync(id, now, cancellationToken))
        {
            return new RevokeInvitationResult.Revoked();
        }

        // Not pending any more, possibly since it was read (a registration or another revoke got there first).
        var current = await invitations.GetByIdAsync(id, cancellationToken);
        var problem = current!.ProblemAt(now)!.Value;
        return problem == InvitationProblem.Revoked
            ? new RevokeInvitationResult.Revoked()
            : new RevokeInvitationResult.Unavailable(problem);
    }

    private async Task<CreatedInvitation> AddAsync(User actor, Guid familyId, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var token = LinkToken.Generate();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            FamilyId = familyId,
            CreatedByUserId = actor.Id,
            CreatedAt = now,
            ExpiresAt = now + InvitationPolicy.Lifetime,
        };
        await invitations.AddAsync(invitation, cancellationToken);
        return new CreatedInvitation(invitation.Id, token, invitation.ExpiresAt);
    }
}
