namespace Nala.Core.Auth;

public interface IPasswordResetTokenRepository
{
    /// <summary>Deletes the user's unused tokens and saves this one, so only the newest link works.</summary>
    Task ReplaceAsync(PasswordResetToken token, CancellationToken cancellationToken = default);

    Task<PasswordResetToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>Marks the token used at <paramref name="now"/> if it is still usable then; false when it is not.</summary>
    Task<bool> ConsumeAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>When the user's newest token (used or not) was created; null when they have none.</summary>
    Task<DateTimeOffset?> LatestCreatedAtAsync(Guid userId, CancellationToken cancellationToken = default);
}
