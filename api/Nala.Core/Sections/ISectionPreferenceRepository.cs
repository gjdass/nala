namespace Nala.Core.Sections;

public interface ISectionPreferenceRepository
{
    /// <summary>The user's stored rows, by position; empty when they never saved any.</summary>
    Task<IReadOnlyList<SectionPreference>> ListAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Replaces every row of the user.</summary>
    Task ReplaceAsync(Guid userId, IReadOnlyList<SectionPreference> preferences, CancellationToken cancellationToken = default);
}
