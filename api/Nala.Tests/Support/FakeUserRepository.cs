using Nala.Core.Users;

namespace Nala.Tests.Support;

public class FakeUserRepository : IUserRepository
{
    public List<User> Users { get; } = [];

    /// <summary>Simulates a unique index violation (e.g. a concurrent setup) on the next save.</summary>
    public bool ConflictOnAdd { get; set; }

    public int Updates { get; private set; }

    public Task<bool> AnyAsync(CancellationToken cancellationToken = default) => Task.FromResult(Users.Count > 0);

    public Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        if (ConflictOnAdd)
        {
            throw new UserConflictException();
        }

        Users.Add(user);
        return Task.CompletedTask;
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.SingleOrDefault(u => u.Id == id));

    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.SingleOrDefault(u => u.Email == email && u.DeletedAt is null));

    public Task UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        Updates++;
        return Task.CompletedTask;
    }
}
