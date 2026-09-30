using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Feeds;

namespace Nala.Sql.Feeds;

public class BreastFeedSegmentConfiguration : IEntityTypeConfiguration<BreastFeedSegment>
{
    public void Configure(EntityTypeBuilder<BreastFeedSegment> segment)
    {
        segment.ToTable("breast_feed_segments");
        segment.HasKey(s => s.Id);
        segment.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
        segment.Property(s => s.FeedId).HasColumnName("feed_id");
        segment.Property(s => s.Side).HasColumnName("side").HasMaxLength(8)
            .HasConversion(s => FeedFields.Format(s), s => FeedFields.ParseSide(s));
        segment.Property(s => s.StartedAt).HasColumnName("started_at");
        segment.Property(s => s.EndedAt).HasColumnName("ended_at");

        segment.HasIndex(s => new { s.FeedId, s.StartedAt }).HasDatabaseName("ix_breast_feed_segments_feed_id_started_at");

        // One side runs at a time (spec 05).
        segment.HasIndex(s => s.FeedId)
            .IsUnique()
            .HasFilter("ended_at IS NULL")
            .HasDatabaseName("ux_breast_feed_segments_open_per_feed");
    }
}
