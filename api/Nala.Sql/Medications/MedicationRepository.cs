using Microsoft.EntityFrameworkCore;
using Nala.Core.Medications;
using Nala.Core.Entries;
using Nala.Core.Users;

namespace Nala.Sql.Medications;

public class MedicationRepository(NalaDbContext db) : IMedicationRepository
{
    public async Task AddAsync(Medication medication, CancellationToken cancellationToken = default)
    {
        db.Set<Medication>().Add(medication);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Medication?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Medication>().SingleOrDefaultAsync(m => m.Id == id, cancellationToken);

    public Task<MedicationEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<Medication>().Where(m => m.Id == id)).SingleOrDefaultAsync(cancellationToken);

    /// <summary>Saves a medication loaded by <see cref="GetAsync"/>.</summary>
    public async Task UpdateAsync(Medication medication, CancellationToken cancellationToken = default) =>
        await db.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(Medication medication, CancellationToken cancellationToken = default)
    {
        db.Set<Medication>().Remove(medication);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<MedicationEntry>> ListAsync(Guid babyId, EntryCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var medications = db.Set<Medication>().Where(m => m.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so medications sharing a time are paged by id without gaps or repeats.
            medications = medications.Where(m => EF.Functions.LessThan(
                ValueTuple.Create(m.Time, m.Id), ValueTuple.Create(after.StartTime, after.Id)));
        }

        return await Entries(medications.OrderByDescending(m => m.Time).ThenByDescending(m => m.Id).Take(limit))
            .ToListAsync(cancellationToken);
    }

    private IQueryable<MedicationEntry> Entries(IQueryable<Medication> medications) =>
        from medication in medications.AsNoTracking()
        join loggedBy in db.Set<User>() on medication.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on medication.UpdatedByUserId equals updatedBy.Id
        select new MedicationEntry(medication, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
