using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Pumps;
using Nala.Core.Users;

namespace Nala.Sql.Pumps;

public class PumpConfiguration : IEntityTypeConfiguration<Pump>
{
    public void Configure(EntityTypeBuilder<Pump> pump)
    {
        pump.ToTable("pumps");
        pump.HasKey(p => p.Id);
        pump.Property(p => p.Id).HasColumnName("id").ValueGeneratedNever();
        pump.Property(p => p.BabyId).HasColumnName("baby_id");
        pump.Property(p => p.StartTime).HasColumnName("start_time");
        pump.Property(p => p.EndTime).HasColumnName("end_time");
        pump.Property(p => p.LeftMl).HasColumnName("left_ml");
        pump.Property(p => p.RightMl).HasColumnName("right_ml");
        pump.Property(p => p.Notes).HasColumnName("notes").HasMaxLength(EntryFields.NotesMaxLength);
        pump.Property(p => p.LoggedByUserId).HasColumnName("logged_by_user_id");
        pump.Property(p => p.CreatedAt).HasColumnName("created_at");
        pump.Property(p => p.UpdatedAt).HasColumnName("updated_at");
        pump.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's pumping sessions go with it (spec 03). Users are only soft-deleted, so who logged a session is always known.
        pump.HasOne<Baby>().WithMany().HasForeignKey(p => p.BabyId).OnDelete(DeleteBehavior.Cascade);
        pump.HasOne<User>().WithMany().HasForeignKey(p => p.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        pump.HasOne<User>().WithMany().HasForeignKey(p => p.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        pump.HasIndex(p => new { p.BabyId, p.StartTime, p.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("ix_pumps_baby_id_start_time_id");
    }
}
