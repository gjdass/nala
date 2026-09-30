using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.Users;

namespace Nala.Sql.Feeds;

public class FeedConfiguration : IEntityTypeConfiguration<Feed>
{
    public void Configure(EntityTypeBuilder<Feed> feed)
    {
        feed.ToTable("feeds");
        feed.HasKey(f => f.Id);
        feed.Property(f => f.Id).HasColumnName("id").ValueGeneratedNever();
        feed.Property(f => f.BabyId).HasColumnName("baby_id");
        feed.Property(f => f.Kind).HasColumnName("kind").HasMaxLength(16)
            .HasConversion(k => FeedFields.Format(k), k => FeedFields.ParseKind(k));
        feed.Property(f => f.StartTime).HasColumnName("start_time");
        feed.Property(f => f.EndTime).HasColumnName("end_time");
        feed.Property(f => f.Notes).HasColumnName("notes").HasMaxLength(FeedFields.NotesMaxLength);
        feed.Property(f => f.MilkType).HasColumnName("milk_type").HasMaxLength(16)
            .HasConversion(m => FeedFields.Format(m!.Value), m => FeedFields.ParseMilkType(m));
        feed.Property(f => f.AmountMl).HasColumnName("amount_ml");
        feed.Property(f => f.LoggedByUserId).HasColumnName("logged_by_user_id");
        feed.Property(f => f.CreatedAt).HasColumnName("created_at");
        feed.Property(f => f.UpdatedAt).HasColumnName("updated_at");
        feed.Property(f => f.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // A baby's feeds go with it (spec 03). Users are only soft-deleted, so who logged a feed is always known.
        feed.HasOne<Baby>().WithMany().HasForeignKey(f => f.BabyId).OnDelete(DeleteBehavior.Cascade);
        feed.HasOne<User>().WithMany().HasForeignKey(f => f.LoggedByUserId).OnDelete(DeleteBehavior.Restrict);
        feed.HasOne<User>().WithMany().HasForeignKey(f => f.UpdatedByUserId).OnDelete(DeleteBehavior.Restrict);
        feed.HasIndex(f => new { f.BabyId, f.StartTime, f.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("ix_feeds_baby_id_start_time_id");
    }
}
