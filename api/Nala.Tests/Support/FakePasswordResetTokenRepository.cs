using Nala.Core.Auth;

namespace Nala.Tests.Support;

public class FakePasswordResetTokenRepository : IPasswordResetTokenRepository
{
    public List<PasswordResetToken> Tokens { get; } = [];

    /// <summary>Simulates another reset consuming the link first.</summary>
    public bool ConsumedConcurrently { get; set; }

    public Task ReplaceAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
    {
        Tokens.RemoveAll(t => t.UserId == token.UserId && t.UsedAt is null);
        Tokens.Add(token);
        return Task.CompletedTask;
    }

    public Task<PasswordResetToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        Task.FromResult(Tokens.SingleOrDefault(t => t.TokenHash == tokenHash));

    public Task<bool> ConsumeAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var token = Tokens.Single(t => t.Id == id);
        if (ConsumedConcurrently || token.ProblemAt(now) is not null)
        {
            return Task.FromResult(false);
        }

        token.UsedAt = now;
        return Task.FromResult(true);
    }
}
