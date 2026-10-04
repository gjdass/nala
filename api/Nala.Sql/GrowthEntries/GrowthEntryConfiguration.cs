using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.GrowthEntries;
using Nala.Core.Users;

namespace Nala.Sql.GrowthEntries;

public class GrowthEntryConfiguration : IEntityTypeConfiguration<GrowthEntry>
{
    public void Configure(EntityTypeBuilder<GrowthEntry> growthEntry)
    {
        growthEntry.ToTable("growth_entries");
        growthEntry.HasKey(g => g.Id);
        growthEntry.Property(g => g.Id).HasColumnName("id").ValueGeneratedNever();
        growthEntry.Property(g => g.BabyId).HasColumnName("baby_id");
        growthEntry.Property(g => g.Kind).HasColumnName("kind").HasMaxLength(16)
            .HasConversion(k => GrowthEntryFields.Format(k), k => GrowthEntryFields.ParseKind(k));
        growthEntry.Property(g => g.Date).HasColumnName("date");
        growthEntry.Property(g => g.WeightG).HasColumnName("weight_g");
        growthEntry.Property(g => g.LengthCm).HasColumnName("length_cm").HasPrecision(4, 1);
        growthEntry.Property(g => g.HeadCircumferenceCm).HasColumnName("head_circumference_cm").HasPrecision(4, 1);
        growthEntry.Property(g => g.Notes).HasColumnName("notes").HasMaxLength(EntryFields.NotesMaxLength);
        growthEntry.Property(g => g.LoggedByUserId).HasColumnName("logged_by_user_id");
        growthEntry.Property(g => g.CreatedAt).HasColumnName("created_at");
        growthEntry.Property(g => g.UpdatedAt).HasColumnName("updated_at");
        growthEntry.Property(g => g.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's growth entries go with it (spec 03). Users are only soft-deleted, so who logged an entry is always known.
        growthEntry.HasOne<Baby>().WithMany().HasForeignKey(g => g.BabyId).OnDelete(DeleteBehavior.Cascade);
        growthEntry.HasOne<User>().WithMany().HasForeignKey(g => g.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        growthEntry.HasOne<User>().WithMany().HasForeignKey(g => g.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        growthEntry.HasIndex(g => new { g.BabyId, g.Date, g.CreatedAt, g.Id })
            .IsDescending(false, true, true, true)
            .HasDatabaseName("ix_growth_entries_baby_id_date_created_at_id");
    }
}
