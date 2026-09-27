using Nala.Core.Users;

namespace Nala.Core.Auth;

/// <param name="Renewed">True when the use extended the session, so the cookie should be reissued too.</param>
public sealed record SessionValidation(User User, bool Renewed);

/// <summary>Server-side sessions behind the auth cookie.</summary>
public class SessionService(ISessionRepository sessions, IUserRepository users, TimeProvider time)
{
    public async Task<Session> StartAsync(User user, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var session = new Session { Id = Guid.NewGuid(), UserId = user.Id, CreatedAt = now, LastSeenAt = now };
        await sessions.AddAsync(session, cancellationToken);
        return session;
    }

    /// <summary>The session's user, extending the session; null when it is unknown, expired or its user is gone.</summary>
    public async Task<SessionValidation?> ValidateAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var session = await sessions.GetAsync(sessionId, cancellationToken);
        if (session is null)
        {
            return null;
        }

        var now = time.GetUtcNow();
        var user = await users.GetByIdAsync(session.UserId, cancellationToken);
        if (now - session.LastSeenAt >= SessionPolicy.IdleTimeout || user is not { DeletedAt: null })
        {
            await sessions.DeleteAsync(sessionId, cancellationToken);
            return null;
        }

        if (now - session.LastSeenAt < SessionPolicy.TouchInterval)
        {
            return new SessionValidation(user, Renewed: false);
        }

        session.LastSeenAt = now;
        await sessions.TouchAsync(session, cancellationToken);
        return new SessionValidation(user, Renewed: true);
    }

    public Task EndAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
        sessions.DeleteAsync(sessionId, cancellationToken);
}
