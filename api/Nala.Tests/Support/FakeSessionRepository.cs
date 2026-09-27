using Nala.Core.Auth;

namespace Nala.Tests.Support;

public class FakeSessionRepository : ISessionRepository
{
    public Dictionary<Guid, Session> Sessions { get; } = [];

    public int Touches { get; private set; }

    public Task AddAsync(Session session, CancellationToken cancellationToken = default)
    {
        Sessions.Add(session.Id, session);
        return Task.CompletedTask;
    }

    public Task<Session?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Sessions.GetValueOrDefault(id));

    public Task TouchAsync(Session session, CancellationToken cancellationToken = default)
    {
        Touches++;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        Sessions.Remove(id);
        return Task.CompletedTask;
    }
}
