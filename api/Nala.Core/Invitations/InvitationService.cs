using Nala.Core.Auth;
using Nala.Core.Email;
using Nala.Core.Users;

namespace Nala.Core.Invitations;

/// <summary>The token goes in the link <c>/invite/{token}</c>; only its hash is stored.</summary>
public sealed record CreatedInvitation(Guid Id, string Token, DateTimeOffset ExpiresAt);

/// <summary><c>CreatedBy</c> is the creator's display name.</summary>
public sealed record PendingInvitation(Guid Id, string CreatedBy, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

public abstract record RevokeInvitationResult
{
    /// <summary>Revoked now, or already revoked.</summary>
    public sealed record Revoked : RevokeInvitationResult;

    public sealed record NotFound : RevokeInvitationResult;

    /// <summary>Used or expired: there is nothing left to revoke.</summary>
    public sealed record Unavailable(InvitationProblem Problem) : RevokeInvitationResult;
}

public abstract record SendInvitationResult
{
    public sealed record Sent(DateTimeOffset ExpiresAt) : SendInvitationResult;

    /// <summary>Field name → error code (<c>email</c>: <c>required</c>, <c>invalid</c>, <c>taken</c>).</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : SendInvitationResult;
}

/// <summary>Invitation links. Every member can create, list and revoke them.</summary>
public class InvitationService(IInvitationRepository invitations, IUserRepository users, IEmailOutbox outbox, TimeProvider time)
{
    public async Task<CreatedInvitation> CreateAsync(User actor, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var token = LinkToken.Generate();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            CreatedByUserId = actor.Id,
            CreatedAt = now,
            ExpiresAt = now + InvitationPolicy.Lifetime,
        };
        await invitations.AddAsync(invitation, cancellationToken);
        return new CreatedInvitation(invitation.Id, token, invitation.ExpiresAt);
    }

    /// <summary>
    /// Creates an invitation and queues its link to <paramref name="email"/>, in the inviter's language. The address is
    /// only used for sending; an email that already has an account is refused.
    /// </summary>
    public async Task<SendInvitationResult> SendByEmailAsync(
        User actor, string? email, Uri publicUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Invalid("required");
        }

        if (!EmailAddress.TryNormalize(email, out var normalized))
        {
            return Invalid("invalid");
        }

        if (await users.GetByEmailAsync(normalized, cancellationToken) is not null)
        {
            return Invalid("taken");
        }

        var created = await CreateAsync(actor, cancellationToken);
        outbox.Enqueue(InvitationEmail.Compose(actor, normalized, publicUrl, created.Token, created.ExpiresAt));
        return new SendInvitationResult.Sent(created.ExpiresAt);

        static SendInvitationResult.Invalid Invalid(string code) => new(new Dictionary<string, string> { ["email"] = code });
    }

    /// <summary>Unused, unexpired and unrevoked invitations, newest first.</summary>
    public async Task<IReadOnlyList<PendingInvitation>> ListPendingAsync(CancellationToken cancellationToken = default)
    {
        var pending = await invitations.ListPendingAsync(time.GetUtcNow(), cancellationToken);

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

    /// <summary>Idempotent: an already revoked invitation stays as it was.</summary>
    public async Task<RevokeInvitationResult> RevokeAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var invitation = await invitations.GetByIdAsync(id, cancellationToken);
        if (invitation is null)
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
}
