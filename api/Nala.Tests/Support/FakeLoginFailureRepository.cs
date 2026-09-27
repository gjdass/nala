using Nala.Core.Auth;

namespace Nala.Tests.Support;

public class FakeLoginFailureRepository : ILoginFailureRepository
{
    public List<(string Email, DateTimeOffset FailedAt)> Failures { get; } = [];

    public Task<int> CountSinceAsync(string email, DateTimeOffset since, CancellationToken cancellationToken = default) =>
        Task.FromResult(Failures.Count(f => f.Email == email && f.FailedAt > since));

    public Task AddAsync(string email, DateTimeOffset failedAt, CancellationToken cancellationToken = default)
    {
        Failures.Add((email, failedAt));
        return Task.CompletedTask;
    }

    public Task ClearAsync(string email, CancellationToken cancellationToken = default)
    {
        Failures.RemoveAll(f => f.Email == email);
        return Task.CompletedTask;
    }
}
