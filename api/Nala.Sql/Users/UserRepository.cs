using Microsoft.EntityFrameworkCore;
using Nala.Core.Users;
using Npgsql;

namespace Nala.Sql.Users;

public class UserRepository(NalaDbContext db) : IUserRepository
{
    public Task<bool> AnyAsync(CancellationToken cancellationToken = default) =>
        db.Set<User>().AnyAsync(cancellationToken);

    public async Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        db.Set<User>().Add(user);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(user).State = EntityState.Detached;
            throw new UserConflictException(e);
        }
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<User>().SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        db.Set<User>().SingleOrDefaultAsync(u => u.Email == email && u.DeletedAt == null, cancellationToken);

    public async Task UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        db.Set<User>().Update(user);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<User>> ListActiveAsync(CancellationToken cancellationToken = default) =>
        await db.Set<User>().Where(u => u.DeletedAt == null).ToListAsync(cancellationToken);

    public Task SetLastActivityAsync(Guid id, DateTimeOffset at, CancellationToken cancellationToken = default) =>
        db.Set<User>()
            .Where(u => u.Id == id)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.LastActivityAt, at), cancellationToken);
}
