using Nala.Core.Entries;

namespace Nala.Core.Medications;

public interface IMedicationRepository
{
    Task AddAsync(Medication medication, CancellationToken cancellationToken = default);

    /// <summary>Tracked, so <see cref="UpdateAsync"/> saves its changes; null when unknown.</summary>
    Task<Medication?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>With the display names of who logged and last updated it; null when unknown.</summary>
    Task<MedicationEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task UpdateAsync(Medication medication, CancellationToken cancellationToken = default);

    Task DeleteAsync(Medication medication, CancellationToken cancellationToken = default);

    /// <summary>The baby's medications, newest first (time, then id, both descending), after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<MedicationEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// The baby's <paramref name="limit"/> most recently given names, distinct whatever their case, most recent first
    /// (time, then id), each with the spelling and dose of its latest entry.
    /// </summary>
    Task<IReadOnlyList<RecentMedication>> ListRecentAsync(Guid babyId, int limit, CancellationToken cancellationToken = default);
}
