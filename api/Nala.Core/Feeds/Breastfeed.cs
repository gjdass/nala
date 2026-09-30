namespace Nala.Core.Feeds;

/// <summary>What a breastfeed's segments give; derived, never stored (spec 05).</summary>
public static class Breastfeed
{
    /// <summary>The sum of the side's segments; the running one counts up to <paramref name="now"/>.</summary>
    public static TimeSpan SideDuration(Feed feed, BreastSide side, DateTimeOffset now) =>
        feed.Segments
            .Where(s => s.Side == side)
            .Aggregate(TimeSpan.Zero, (total, s) => total + ((s.EndedAt ?? now) - s.StartedAt));

    public static BreastSide? RunningSide(Feed feed) =>
        feed.Segments.FirstOrDefault(s => s.EndedAt is null)?.Side;

    /// <summary>The side of its last segment.</summary>
    public static BreastSide? EndedOnSide(Feed feed) =>
        feed.Segments.MaxBy(s => s.StartedAt)?.Side;

    /// <summary>The open segment, whose side runs now; null when paused.</summary>
    public static BreastFeedSegment? OpenSegment(Feed feed) =>
        feed.Segments.FirstOrDefault(s => s.EndedAt is null);

    /// <summary>The latest time of its segments (the running one's start, else the last end): timer actions can't go before it.</summary>
    public static DateTimeOffset? LatestSegmentTime(Feed feed) =>
        feed.Segments.Count == 0 ? null : feed.Segments.Max(s => s.EndedAt ?? s.StartedAt);

    /// <summary>Durations typed by hand as segments: back to back from <paramref name="start"/>, zero sides left out, <paramref name="endedOn"/> last.</summary>
    public static List<BreastFeedSegment> SyntheticSegments(
        Guid feedId, DateTimeOffset start, TimeSpan left, TimeSpan right, BreastSide endedOn)
    {
        var sides = endedOn == BreastSide.Left
            ? new[] { (BreastSide.Right, right), (BreastSide.Left, left) }
            : new[] { (BreastSide.Left, left), (BreastSide.Right, right) };
        var segments = new List<BreastFeedSegment>();
        var at = start;
        foreach (var (side, duration) in sides.Where(s => s.Item2 > TimeSpan.Zero))
        {
            segments.Add(new BreastFeedSegment { Id = Guid.NewGuid(), FeedId = feedId, Side = side, StartedAt = at, EndedAt = at + duration });
            at += duration;
        }

        return segments;
    }
}
