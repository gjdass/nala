namespace Nala.Core.Auth;

public interface ISessionRepository
{
    Task AddAsync(Session session, CancellationToken cancellationToken = default);

    Task<Session?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Saves the new <see cref="Session.LastSeenAt"/>.</summary>
    Task TouchAsync(Session session, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Deletes every session of the user except <paramref name="keepSessionId"/>.</summary>
    Task DeleteOthersAsync(Guid userId, Guid keepSessionId, CancellationToken cancellationToken = default);
}
