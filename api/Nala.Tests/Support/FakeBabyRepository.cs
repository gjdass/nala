using Nala.Core.Babies;

namespace Nala.Tests.Support;

/// <summary>Lists through the given family repository's memberships, like the real join; without one, every baby.</summary>
public class FakeBabyRepository(FakeFamilyRepository? families = null) : IBabyRepository
{
    public List<Baby> Babies { get; } = [];

    public Task AddAsync(Baby baby, CancellationToken cancellationToken = default)
    {
        Babies.Add(baby);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Baby>> ListForUserAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Baby>>(Babies
            .Where(b => families is null || families.Memberships.Any(m => m.FamilyId == b.FamilyId && m.UserId == userId))
            .OrderBy(b => b.BirthDate)
            .ThenBy(b => b.CreatedAt)
            .ToList());

    public Task<Baby?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Babies.SingleOrDefault(b => b.Id == id));

    public Task UpdateAsync(Baby baby, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(Baby baby, CancellationToken cancellationToken = default)
    {
        Babies.Remove(baby);
        return Task.CompletedTask;
    }
}
