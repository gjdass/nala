namespace Nala.Core.Invitations;

/// <summary>A single-use link: a join invitation adds a member to its family; a new-family one (no family) lets its recipient create one.</summary>
public class Invitation
{
    public Guid Id { get; init; }

    /// <summary>SHA-256 of the token in the link; the token itself is never stored.</summary>
    public required string TokenHash { get; init; }

    /// <summary>The family a join invitation adds a member to; null for a new-family invitation.</summary>
    public Guid? FamilyId { get; init; }

    public InvitationKind Kind => FamilyId is null ? InvitationKind.NewFamily : InvitationKind.Join;

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
