namespace Nala.Core.Auth;

/// <summary>Why a password reset link cannot be used.</summary>
public enum ResetLinkProblem
{
    Unknown,
    Expired,
    Used,
}
