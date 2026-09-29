namespace Nala.Core.Babies;

public interface IBabyRepository
{
    Task AddAsync(Baby baby, CancellationToken cancellationToken = default);

    /// <summary>Oldest birth date first, then by creation time.</summary>
    Task<IReadOnlyList<Baby>> ListAsync(CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<Baby?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(Baby baby, CancellationToken cancellationToken = default);

    Task DeleteAsync(Baby baby, CancellationToken cancellationToken = default);
}
