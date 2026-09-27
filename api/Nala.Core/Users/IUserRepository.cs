namespace Nala.Core.Users;

public interface IUserRepository
{
    Task<bool> AnyAsync(CancellationToken cancellationToken = default);

    /// <summary>Saves a new user. Throws <see cref="UserConflictException"/> when the email or the admin slot is taken.</summary>
    Task AddAsync(User user, CancellationToken cancellationToken = default);

    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>The non-deleted user with this normalized email.</summary>
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>Saves the changes made to a user read from this repository.</summary>
    Task UpdateAsync(User user, CancellationToken cancellationToken = default);
}
