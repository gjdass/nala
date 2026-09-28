namespace Nala.Core.Babies;

public interface IBabyRepository
{
    Task AddAsync(Baby baby, CancellationToken cancellationToken = default);

    /// <summary>Oldest birth date first, then by creation time.</summary>
    Task<IReadOnlyList<Baby>> ListAsync(CancellationToken cancellationToken = default);
}
