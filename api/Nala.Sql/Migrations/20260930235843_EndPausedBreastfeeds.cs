using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <summary>
    /// Spec 05 "live or not": a breastfeed paused before (no end time, no running side) becomes an ordinary feed, ending
    /// where its last segment ends (its start time when it has none). Data only.
    /// </summary>
    public partial class EndPausedBreastfeeds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE feeds AS f
                SET end_time = COALESCE(
                    (SELECT max(s.ended_at) FROM breast_feed_segments AS s WHERE s.feed_id = f.id),
                    f.start_time)
                WHERE f.kind = 'breastfeed'
                  AND f.end_time IS NULL
                  AND NOT EXISTS (SELECT 1 FROM breast_feed_segments AS s WHERE s.feed_id = f.id AND s.ended_at IS NULL);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Which feeds were paused isn't kept: nothing to undo.
        }
    }
}
