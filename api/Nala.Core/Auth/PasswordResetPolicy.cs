namespace Nala.Core.Auth;

public static class PasswordResetPolicy
{
    /// <summary>A link the admin generates and hands over.</summary>
    public static readonly TimeSpan AdminLinkLifetime = TimeSpan.FromHours(24);
}
