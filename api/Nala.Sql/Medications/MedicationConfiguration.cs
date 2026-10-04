using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Medications;
using Nala.Core.Users;

namespace Nala.Sql.Medications;

public class MedicationConfiguration : IEntityTypeConfiguration<Medication>
{
    public void Configure(EntityTypeBuilder<Medication> medication)
    {
        medication.ToTable("medications");
        medication.HasKey(m => m.Id);
        medication.Property(m => m.Id).HasColumnName("id").ValueGeneratedNever();
        medication.Property(m => m.BabyId).HasColumnName("baby_id");
        medication.Property(m => m.Time).HasColumnName("time");
        medication.Property(m => m.Name).HasColumnName("name").HasMaxLength(MedicationFields.NameMaxLength);
        medication.Property(m => m.Amount).HasColumnName("amount").HasPrecision(6, 2);
        medication.Property(m => m.Unit).HasColumnName("unit").HasMaxLength(8)
            .HasConversion(u => MedicationFields.Format(u!.Value), u => MedicationFields.ParseUnit(u));
        medication.Property(m => m.Notes).HasColumnName("notes").HasMaxLength(EntryFields.NotesMaxLength);
        medication.Property(m => m.LoggedByUserId).HasColumnName("logged_by_user_id");
        medication.Property(m => m.CreatedAt).HasColumnName("created_at");
        medication.Property(m => m.UpdatedAt).HasColumnName("updated_at");
        medication.Property(m => m.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's doses go with it (spec 03). Users are only soft-deleted, so who logged a dose is always known.
        medication.HasOne<Baby>().WithMany().HasForeignKey(m => m.BabyId).OnDelete(DeleteBehavior.Cascade);
        medication.HasOne<User>().WithMany().HasForeignKey(m => m.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        medication.HasOne<User>().WithMany().HasForeignKey(m => m.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        medication.HasIndex(m => new { m.BabyId, m.Time, m.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("ix_medications_baby_id_time_id");
    }
}
