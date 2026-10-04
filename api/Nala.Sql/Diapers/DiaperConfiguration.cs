using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Diapers;
using Nala.Core.Entries;
using Nala.Core.Users;

namespace Nala.Sql.Diapers;

public class DiaperConfiguration : IEntityTypeConfiguration<Diaper>
{
    public void Configure(EntityTypeBuilder<Diaper> diaper)
    {
        diaper.ToTable("diapers");
        diaper.HasKey(d => d.Id);
        diaper.Property(d => d.Id).HasColumnName("id").ValueGeneratedNever();
        diaper.Property(d => d.BabyId).HasColumnName("baby_id");
        diaper.Property(d => d.Time).HasColumnName("time");
        diaper.Property(d => d.Wet).HasColumnName("wet");
        diaper.Property(d => d.Dirty).HasColumnName("dirty");
        diaper.Property(d => d.Rash).HasColumnName("rash");
        diaper.Property(d => d.Notes).HasColumnName("notes").HasMaxLength(EntryFields.NotesMaxLength);
        diaper.Property(d => d.LoggedByUserId).HasColumnName("logged_by_user_id");
        diaper.Property(d => d.CreatedAt).HasColumnName("created_at");
        diaper.Property(d => d.UpdatedAt).HasColumnName("updated_at");
        diaper.Property(d => d.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's diapers go with it (spec 03). Users are only soft-deleted, so who logged a diaper is always known.
        diaper.HasOne<Baby>().WithMany().HasForeignKey(d => d.BabyId).OnDelete(DeleteBehavior.Cascade);
        diaper.HasOne<User>().WithMany().HasForeignKey(d => d.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        diaper.HasOne<User>().WithMany().HasForeignKey(d => d.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        diaper.HasIndex(d => new { d.BabyId, d.Time, d.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("ix_diapers_baby_id_time_id");
    }
}
