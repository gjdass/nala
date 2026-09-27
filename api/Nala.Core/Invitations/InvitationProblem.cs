namespace Nala.Core.Invitations;

/// <summary>Why an invitation link cannot be used.</summary>
public enum InvitationProblem
{
    Unknown,
    Expired,
    Used,
    Revoked,
}
