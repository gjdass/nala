using Nala.Core.Feeds;

namespace Nala.Tests.Core;

public class BreastfeedTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private static Feed WithSegments(params (BreastSide Side, int StartMinute, int? EndMinute)[] segments) => new()
    {
        Id = Guid.NewGuid(),
        Kind = FeedKind.Breastfeed,
        StartTime = Now.AddMinutes(-60),
        Segments = segments
            .Select(s => new BreastFeedSegment
            {
                Id = Guid.NewGuid(),
                Side = s.Side,
                StartedAt = Now.AddMinutes(-60 + s.StartMinute),
                EndedAt = s.EndMinute is { } end ? Now.AddMinutes(-60 + end) : null,
            })
            .ToList(),
    };

    [Test]
    public void A_side_lasts_the_sum_of_its_segments()
    {
        var feed = WithSegments((BreastSide.Left, 0, 5), (BreastSide.Right, 5, 8), (BreastSide.Left, 8, 10));

        Assert.Multiple(() =>
        {
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Left, Now), Is.EqualTo(TimeSpan.FromMinutes(7)));
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Right, Now), Is.EqualTo(TimeSpan.FromMinutes(3)));
        });
    }

    [Test]
    public void The_running_segment_counts_up_to_now()
    {
        var feed = WithSegments((BreastSide.Left, 0, 5), (BreastSide.Right, 50, null));

        Assert.Multiple(() =>
        {
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Right, Now), Is.EqualTo(TimeSpan.FromMinutes(10)));
            Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Right));
        });
    }

    [Test]
    public void The_feed_ended_on_the_side_of_its_last_segment()
    {
        var feed = WithSegments((BreastSide.Right, 5, 8), (BreastSide.Left, 0, 5));

        Assert.Multiple(() =>
        {
            Assert.That(Breastfeed.EndedOnSide(feed), Is.EqualTo(BreastSide.Right));
            Assert.That(Breastfeed.RunningSide(feed), Is.Null);
        });
    }

    [Test]
    public void Without_segments_both_sides_are_zero_and_no_side_is_known()
    {
        var feed = WithSegments();

        Assert.Multiple(() =>
        {
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Left, Now), Is.EqualTo(TimeSpan.Zero));
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Right, Now), Is.EqualTo(TimeSpan.Zero));
            Assert.That(Breastfeed.EndedOnSide(feed), Is.Null);
            Assert.That(Breastfeed.RunningSide(feed), Is.Null);
        });
    }

    [Test]
    public void Typed_durations_run_back_to_back_from_the_start_with_the_ended_on_side_last()
    {
        var feedId = Guid.NewGuid();
        var start = Now.AddMinutes(-60);

        var segments = Breastfeed.SyntheticSegments(feedId, start, TimeSpan.FromMinutes(5), TimeSpan.FromSeconds(210), BreastSide.Left);

        Assert.Multiple(() =>
        {
            Assert.That(segments.Select(s => (s.Side, s.StartedAt, s.EndedAt)), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[]
            {
                (BreastSide.Right, start, start.AddSeconds(210)),
                (BreastSide.Left, start.AddSeconds(210), start.AddSeconds(510)),
            }));
            Assert.That(segments.Select(s => s.FeedId), Is.All.EqualTo(feedId));
            Assert.That(segments.Select(s => s.Id).Distinct().Count(), Is.EqualTo(2));
        });
    }

    [Test]
    public void A_side_typed_at_zero_gets_no_segment()
    {
        var start = Now.AddMinutes(-60);

        var segments = Breastfeed.SyntheticSegments(Guid.NewGuid(), start, TimeSpan.Zero, TimeSpan.FromMinutes(8), BreastSide.Left);

        Assert.That(segments.Select(s => (s.Side, s.StartedAt, s.EndedAt)), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[]
        {
            (BreastSide.Right, start, start.AddMinutes(8)),
        }));
    }
}
