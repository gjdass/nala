using Nala.Core.Account;
using Nala.Core.Users;

namespace Nala.Tests.Support;

/// <summary>Records each account deletion; what it deletes is tested on the real repository.</summary>
public class FakeAccountRepository : IAccountRepository
{
    public List<(User User, DateTimeOffset Now)> Deletions { get; } = [];

    public Task DeleteAsync(User user, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        Deletions.Add((user, now));
        return Task.CompletedTask;
    }
}
