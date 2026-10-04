using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.HealthEntries;
using Nala.Core.Users;

namespace Nala.Sql.HealthEntries;

public class HealthEntryConfiguration : IEntityTypeConfiguration<HealthEntry>
{
    public void Configure(EntityTypeBuilder<HealthEntry> healthEntry)
    {
        healthEntry.ToTable("health_entries");
        healthEntry.HasKey(m => m.Id);
        healthEntry.Property(m => m.Id).HasColumnName("id").ValueGeneratedNever();
        healthEntry.Property(m => m.BabyId).HasColumnName("baby_id");
        healthEntry.Property(m => m.Time).HasColumnName("time");
        healthEntry.Property(m => m.Name).HasColumnName("name").HasMaxLength(HealthEntryFields.NameMaxLength);
        healthEntry.Property(m => m.Amount).HasColumnName("amount").HasPrecision(6, 2);
        healthEntry.Property(m => m.Unit).HasColumnName("unit").HasMaxLength(8)
            .HasConversion(u => HealthEntryFields.Format(u!.Value), u => HealthEntryFields.ParseUnit(u));
        healthEntry.Property(m => m.Temperature).HasColumnName("temperature").HasPrecision(3, 1);
        healthEntry.Property(m => m.Notes).HasColumnName("notes").HasMaxLength(EntryFields.NotesMaxLength);
        healthEntry.Property(m => m.LoggedByUserId).HasColumnName("logged_by_user_id");
        healthEntry.Property(m => m.CreatedAt).HasColumnName("created_at");
        healthEntry.Property(m => m.UpdatedAt).HasColumnName("updated_at");
        healthEntry.Property(m => m.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's doses go with it (spec 03). Users are only soft-deleted, so who logged a dose is always known.
        healthEntry.HasOne<Baby>().WithMany().HasForeignKey(m => m.BabyId).OnDelete(DeleteBehavior.Cascade);
        healthEntry.HasOne<User>().WithMany().HasForeignKey(m => m.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        healthEntry.HasOne<User>().WithMany().HasForeignKey(m => m.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        healthEntry.HasIndex(m => new { m.BabyId, m.Time, m.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("ix_health_entries_baby_id_time_id");
    }
}
