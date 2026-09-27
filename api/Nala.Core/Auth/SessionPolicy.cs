namespace Nala.Core.Auth;

/// <summary>Rolling sessions: every use extends them; they expire after <see cref="IdleTimeout"/> without any use.</summary>
public static class SessionPolicy
{
    public static readonly TimeSpan IdleTimeout = TimeSpan.FromDays(90);

    /// <summary>Uses closer together than this don't write the new last-seen time, to avoid a database write per request.</summary>
    public static readonly TimeSpan TouchInterval = TimeSpan.FromMinutes(1);
}
