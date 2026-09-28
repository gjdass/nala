namespace Nala.Core.Auth;

public static class PasswordResetPolicy
{
    /// <summary>A link the admin generates and hands over.</summary>
    public static readonly TimeSpan AdminLinkLifetime = TimeSpan.FromHours(24);

    /// <summary>A link sent by email after "Forgot password".</summary>
    public static readonly TimeSpan EmailLinkLifetime = TimeSpan.FromHours(1);

    /// <summary>No email is sent while the user's newest link is younger than this, so requests can't flood an inbox.</summary>
    public static readonly TimeSpan EmailInterval = TimeSpan.FromMinutes(5);
}
