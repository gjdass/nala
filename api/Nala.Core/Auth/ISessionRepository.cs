namespace Nala.Core.Auth;

public interface ISessionRepository
{
    Task AddAsync(Session session, CancellationToken cancellationToken = default);

    Task<Session?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Saves the new <see cref="Session.LastSeenAt"/>.</summary>
    Task TouchAsync(Session session, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
