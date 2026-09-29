using Nala.Core.Babies;

namespace Nala.Tests.Support;

public class FakeBabyRepository : IBabyRepository
{
    public List<Baby> Babies { get; } = [];

    public Task AddAsync(Baby baby, CancellationToken cancellationToken = default)
    {
        Babies.Add(baby);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Baby>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Baby>>(Babies.OrderBy(b => b.BirthDate).ThenBy(b => b.CreatedAt).ToList());

    public Task<Baby?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Babies.SingleOrDefault(b => b.Id == id));

    public Task UpdateAsync(Baby baby, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
