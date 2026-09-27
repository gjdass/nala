namespace Nala.Core.Auth;

/// <summary>After <see cref="MaxFailures"/> failed logins for an email within <see cref="Window"/>, further attempts are refused.</summary>
public static class LoginThrottle
{
    public const int MaxFailures = 5;

    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
}
