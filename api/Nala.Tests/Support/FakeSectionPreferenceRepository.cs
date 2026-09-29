using Nala.Core.Sections;

namespace Nala.Tests.Support;

public class FakeSectionPreferenceRepository : ISectionPreferenceRepository
{
    public List<SectionPreference> Preferences { get; } = [];

    public Task<IReadOnlyList<SectionPreference>> ListAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SectionPreference>>(
            Preferences.Where(p => p.UserId == userId).OrderBy(p => p.Position).ToList());

    public Task ReplaceAsync(Guid userId, IReadOnlyList<SectionPreference> preferences, CancellationToken cancellationToken = default)
    {
        Preferences.RemoveAll(p => p.UserId == userId);
        Preferences.AddRange(preferences);
        return Task.CompletedTask;
    }
}
