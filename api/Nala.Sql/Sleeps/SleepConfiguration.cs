using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Sleeps;
using Nala.Core.Users;

namespace Nala.Sql.Sleeps;

public class SleepConfiguration : IEntityTypeConfiguration<Sleep>
{
    public void Configure(EntityTypeBuilder<Sleep> sleep)
    {
        sleep.ToTable("sleeps");
        sleep.HasKey(s => s.Id);
        sleep.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
        sleep.Property(s => s.BabyId).HasColumnName("baby_id");
        sleep.Property(s => s.StartTime).HasColumnName("start_time");
        sleep.Property(s => s.EndTime).HasColumnName("end_time");
        sleep.Property(s => s.Notes).HasColumnName("notes").HasMaxLength(EntryFields.NotesMaxLength);
        sleep.Property(s => s.LoggedByUserId).HasColumnName("logged_by_user_id");
        sleep.Property(s => s.CreatedAt).HasColumnName("created_at");
        sleep.Property(s => s.UpdatedAt).HasColumnName("updated_at");
        sleep.Property(s => s.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's sleeps go with it (spec 03). Users are only soft-deleted, so who logged a sleep is always known.
        sleep.HasOne<Baby>().WithMany().HasForeignKey(s => s.BabyId).OnDelete(DeleteBehavior.Cascade);
        sleep.HasOne<User>().WithMany().HasForeignKey(s => s.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        sleep.HasOne<User>().WithMany().HasForeignKey(s => s.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        sleep.HasIndex(s => new { s.BabyId, s.StartTime, s.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("ix_sleeps_baby_id_start_time_id");
    }
}
