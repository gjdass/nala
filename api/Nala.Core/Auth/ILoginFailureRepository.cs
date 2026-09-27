namespace Nala.Core.Auth;

/// <summary>Failed logins per normalized email, whether or not an account has that email.</summary>
public interface ILoginFailureRepository
{
    Task<int> CountSinceAsync(string email, DateTimeOffset since, CancellationToken cancellationToken = default);

    Task AddAsync(string email, DateTimeOffset failedAt, CancellationToken cancellationToken = default);

    Task ClearAsync(string email, CancellationToken cancellationToken = default);
}
