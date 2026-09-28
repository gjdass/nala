namespace Nala.Core.Auth;

/// <summary>A one-time link that lets a user set a new password.</summary>
public class PasswordResetToken
{
    public Guid Id { get; init; }

    /// <summary>SHA-256 of the token in the link; the token itself is never stored.</summary>
    public required string TokenHash { get; init; }

    public Guid UserId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? UsedAt { get; set; }

    /// <summary>Why the link can't be used at <paramref name="now"/>; null when it can.</summary>
    public ResetLinkProblem? ProblemAt(DateTimeOffset now) =>
        UsedAt is not null ? ResetLinkProblem.Used
        : now >= ExpiresAt ? ResetLinkProblem.Expired
        : null;
}
