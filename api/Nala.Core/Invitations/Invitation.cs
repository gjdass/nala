namespace Nala.Core.Invitations;

/// <summary>A single-use link that lets someone create an account and join the family.</summary>
public class Invitation
{
    public Guid Id { get; init; }

    /// <summary>SHA-256 of the token in the link; the token itself is never stored.</summary>
    public required string TokenHash { get; init; }

    public Guid CreatedByUserId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public Guid? UsedByUserId { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>Why the invitation can't be used at <paramref name="now"/>; null when it can.</summary>
    public InvitationProblem? ProblemAt(DateTimeOffset now) =>
        UsedAt is not null ? InvitationProblem.Used
        : RevokedAt is not null ? InvitationProblem.Revoked
        : now >= ExpiresAt ? InvitationProblem.Expired
        : null;
}
