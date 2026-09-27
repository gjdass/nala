using Microsoft.EntityFrameworkCore;
using Nala.Core.Auth;

namespace Nala.Sql.Auth;

public class LoginFailureRepository(NalaDbContext db) : ILoginFailureRepository
{
    public Task<int> CountSinceAsync(string email, DateTimeOffset since, CancellationToken cancellationToken = default) =>
        db.Set<LoginFailure>().CountAsync(f => f.Email == email && f.FailedAt > since, cancellationToken);

    public async Task AddAsync(string email, DateTimeOffset failedAt, CancellationToken cancellationToken = default)
    {
        db.Set<LoginFailure>().Add(new LoginFailure { Email = email, FailedAt = failedAt });
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task ClearAsync(string email, CancellationToken cancellationToken = default) =>
        db.Set<LoginFailure>().Where(f => f.Email == email).ExecuteDeleteAsync(cancellationToken);
}
