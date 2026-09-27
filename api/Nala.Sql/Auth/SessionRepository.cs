using Microsoft.EntityFrameworkCore;
using Nala.Core.Auth;

namespace Nala.Sql.Auth;

public class SessionRepository(NalaDbContext db) : ISessionRepository
{
    public async Task AddAsync(Session session, CancellationToken cancellationToken = default)
    {
        db.Set<Session>().Add(session);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Session?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Session>().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);

    public Task TouchAsync(Session session, CancellationToken cancellationToken = default) =>
        db.Set<Session>()
            .Where(s => s.Id == session.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.LastSeenAt, session.LastSeenAt), cancellationToken);

    public Task DeleteAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Session>().Where(s => s.Id == id).ExecuteDeleteAsync(cancellationToken);

    public Task DeleteOthersAsync(Guid userId, Guid keepSessionId, CancellationToken cancellationToken = default) =>
        db.Set<Session>().Where(s => s.UserId == userId && s.Id != keepSessionId).ExecuteDeleteAsync(cancellationToken);

    public Task DeleteAllAsync(Guid userId, CancellationToken cancellationToken = default) =>
        db.Set<Session>().Where(s => s.UserId == userId).ExecuteDeleteAsync(cancellationToken);
}
