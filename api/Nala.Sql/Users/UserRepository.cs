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
}
