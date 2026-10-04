using Nala.Core.Medications;
using Nala.Core.Entries;

namespace Nala.Tests.Support;

public class FakeMedicationRepository : IMedicationRepository
{
    public List<Medication> Medications { get; } = [];

    /// <summary>Display names by user id, as the users table would give them.</summary>
    public Dictionary<Guid, string> Names { get; } = [];

    /// <summary>The limit of the last <see cref="ListRecentAsync"/> call.</summary>
    public int? LastRecentLimit { get; private set; }

    public Task AddAsync(Medication medication, CancellationToken cancellationToken = default)
    {
        Medications.Add(medication);
        return Task.CompletedTask;
    }

    public Task<Medication?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Medications.SingleOrDefault(m => m.Id == id));

    public Task<MedicationEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Medications.Where(m => m.Id == id).Select(ToEntry).SingleOrDefault());

    public Task UpdateAsync(Medication medication, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task DeleteAsync(Medication medication, CancellationToken cancellationToken = default)
    {
        Medications.Remove(medication);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<MedicationEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<MedicationEntry>>(Medications
            .Where(m => m.BabyId == babyId)
            .Where(m => after is null || m.Time < after.StartTime || (m.Time == after.StartTime && m.Id.CompareTo(after.Id) < 0))
            .OrderByDescending(m => m.Time)
            .ThenByDescending(m => m.Id)
            .Take(limit)
            .Select(ToEntry)
            .ToList());

    public Task<IReadOnlyList<RecentMedication>> ListRecentAsync(Guid babyId, int limit, CancellationToken cancellationToken = default)
    {
        LastRecentLimit = limit;
        return Task.FromResult<IReadOnlyList<RecentMedication>>(Medications
            .Where(m => m.BabyId == babyId)
            .OrderByDescending(m => m.Time)
            .ThenByDescending(m => m.Id)
            .DistinctBy(m => m.Name.ToLowerInvariant())
            .Take(limit)
            .Select(m => new RecentMedication(m.Name, m.Amount, m.Unit))
            .ToList());
    }

    private MedicationEntry ToEntry(Medication medication) =>
        new(medication, new UserName(medication.LoggedByUserId, Names[medication.LoggedByUserId]), new UserName(medication.UpdatedByUserId, Names[medication.UpdatedByUserId]));
}
