using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

/// <summary>The breastfeed timer actions of <see cref="FeedService"/> (spec 05: live or not).</summary>
public class BreastfeedServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private FakeFeedRepository _feeds = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private FeedService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _feeds = new FakeFeedRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new FeedService(_feeds, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _feeds.Names[user.Id] = name;
        return user;
    }

    private static DateTimeOffset At(int minutesAgo) => Now.AddMinutes(-minutesAgo);

    private Task<BreastfeedResult> StartAsync(
        Guid feedId, string side, DateTimeOffset at, Guid? segmentId = null, User? by = null, bool queued = false) =>
        _service.StartSideAsync(by ?? _anna, feedId, _lea.Id, segmentId ?? Guid.NewGuid(), side, at, queued);

    private static Feed FeedOf(BreastfeedResult result) => result switch
    {
        BreastfeedResult.Created created => created.Entry.Feed,
        BreastfeedResult.Updated updated => updated.Entry.Feed,
        _ => throw new AssertionException($"Expected a feed, got {result}"),
    };

    /// <summary>A breastfeed stopped <paramref name="minutesAgo"/> minutes ago after 5 minutes on <paramref name="side"/>.</summary>
    private async Task<Guid> FinishedAsync(string side, int minutesAgo)
    {
        var id = Guid.NewGuid();
        await StartAsync(id, side, At(minutesAgo + 5));
        await _service.StopSideAsync(_anna, id, At(minutesAgo));
        return id;
    }

    [Test]
    public async Task Starting_a_side_without_a_feed_creates_an_in_progress_breastfeed()
    {
        var feedId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();

        var result = await StartAsync(feedId, "left", At(10), segmentId);

        var created = (BreastfeedResult.Created)result;
        var feed = _feeds.Feeds.Single();
        Assert.Multiple(() =>
        {
            Assert.That(created.Entry.Feed, Is.SameAs(feed));
            Assert.That(feed.Id, Is.EqualTo(feedId));
            Assert.That(feed.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(feed.Kind, Is.EqualTo(FeedKind.Breastfeed));
            Assert.That(feed.StartTime, Is.EqualTo(At(10)));
            Assert.That(feed.EndTime, Is.Null);
            Assert.That(feed.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(feed.CreatedAt, Is.EqualTo(Now));
            Assert.That(feed.Segments, Has.Count.EqualTo(1));
            Assert.That(feed.Segments[0].Id, Is.EqualTo(segmentId));
            Assert.That(feed.Segments[0].Side, Is.EqualTo(BreastSide.Left));
            Assert.That(feed.Segments[0].StartedAt, Is.EqualTo(At(10)));
            Assert.That(feed.Segments[0].EndedAt, Is.Null);
        });
    }

    [Test]
    public async Task Starting_the_other_side_stops_the_running_one()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10));

        var feed = FeedOf(await StartAsync(feedId, "right", At(4), by: _ben));

        Assert.Multiple(() =>
        {
            Assert.That(feed.Segments.Select(s => (s.Side, s.StartedAt, s.EndedAt)), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[]
            {
                (BreastSide.Left, At(10), At(4)),
                (BreastSide.Right, At(4), null),
            }));
            Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Right));
            Assert.That(feed.UpdatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(feed.UpdatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Starting_the_side_that_already_runs_changes_nothing()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10));

        var feed = FeedOf(await StartAsync(feedId, "left", At(4)));

        Assert.That(feed.Segments, Has.Count.EqualTo(1));
        Assert.That(feed.Segments[0].EndedAt, Is.Null);
    }

    [Test]
    public async Task Resending_a_start_with_the_same_segment_changes_nothing()
    {
        var feedId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10), segmentId);
        await StartAsync(feedId, "right", At(5));

        var feed = FeedOf(await StartAsync(feedId, "left", At(10), segmentId));

        Assert.That(feed.Segments, Has.Count.EqualTo(2));
        Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Right));
    }

    [Test]
    public async Task A_second_breastfeed_cannot_start_while_one_is_in_progress()
    {
        await StartAsync(Guid.NewGuid(), "left", At(10));

        var result = await StartAsync(Guid.NewGuid(), "right", At(5));

        Assert.That(result, Is.InstanceOf<BreastfeedResult.InProgressExists>());
        Assert.That(_feeds.Feeds, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task A_queued_breastfeed_is_kept_as_a_separate_feed_while_another_is_in_progress()
    {
        var current = Guid.NewGuid();
        await StartAsync(current, "left", At(10));
        var queued = Guid.NewGuid();

        var result = await StartAsync(queued, "right", At(20), queued: true);

        Assert.That(result, Is.InstanceOf<BreastfeedResult.Created>());
        Assert.That(_feeds.Feeds.Where(f => f.EndTime is null).Select(f => f.Id), Is.EquivalentTo(new[] { current, queued }));
    }

    [Test]
    public async Task A_queued_start_reopens_a_saved_breastfeed_while_another_is_in_progress()
    {
        var saved = await FinishedAsync("left", 30);
        await StartAsync(Guid.NewGuid(), "left", At(10));

        var feed = FeedOf(await StartAsync(saved, "right", At(5), queued: true));

        Assert.That(feed.EndTime, Is.Null);
        Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Right));
    }

    [Test]
    public async Task Starting_a_side_on_a_saved_breastfeed_reopens_it()
    {
        var feedId = await FinishedAsync("left", 30);

        var feed = FeedOf(await StartAsync(feedId, "right", At(5)));

        Assert.Multiple(() =>
        {
            Assert.That(feed.EndTime, Is.Null);
            Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Right));
            Assert.That(feed.Segments, Has.Count.EqualTo(2));
        });
    }

    [Test]
    public async Task A_saved_breastfeed_cannot_be_reopened_while_another_is_in_progress()
    {
        var saved = await FinishedAsync("left", 30);
        await StartAsync(Guid.NewGuid(), "left", At(10));

        var result = await StartAsync(saved, "right", At(5));

        Assert.That(result, Is.InstanceOf<BreastfeedResult.InProgressExists>());
        Assert.That(_feeds.Feeds.Single(f => f.Id == saved).EndTime, Is.Not.Null);
    }

    [Test]
    public async Task Timer_actions_are_refused_with_invalid_input()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10));

        await Assert.MultipleAsync(async () =>
        {
            Assert.That(((BreastfeedResult.Invalid)await StartAsync(Guid.NewGuid(), "middle", At(1))).Errors,
                Is.EqualTo(new Dictionary<string, string> { ["side"] = "invalid" }));
            Assert.That(((BreastfeedResult.Invalid)await _service.StartSideAsync(_anna, Guid.NewGuid(), _lea.Id, Guid.NewGuid(), null, null)).Errors,
                Is.EqualTo(new Dictionary<string, string> { ["side"] = "required", ["at"] = "required" }));
            Assert.That(((BreastfeedResult.Invalid)await StartAsync(feedId, "right", At(11))).Errors,
                Is.EqualTo(new Dictionary<string, string> { ["at"] = "invalid" }));
            Assert.That(((BreastfeedResult.Invalid)await _service.StopSideAsync(_anna, feedId, At(11))).Errors,
                Is.EqualTo(new Dictionary<string, string> { ["at"] = "invalid" }));
        });
    }

    [Test]
    public async Task Starting_for_an_unknown_baby_is_refused() =>
        Assert.That(
            await _service.StartSideAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "left", At(1)),
            Is.InstanceOf<BreastfeedResult.BabyNotFound>());

    [Test]
    public async Task Timer_actions_on_a_feed_that_is_not_a_breastfeed_are_not_found()
    {
        var bottle = Guid.NewGuid();
        await _service.CreateAsync(_anna, bottle, _lea.Id, new FeedInput("bottle", At(10), null, "formula", 120));

        await Assert.MultipleAsync(async () =>
        {
            Assert.That(await StartAsync(bottle, "left", At(1)), Is.InstanceOf<BreastfeedResult.NotFound>());
            Assert.That(await _service.StopSideAsync(_anna, bottle, At(1)), Is.InstanceOf<BreastfeedResult.NotFound>());
            Assert.That(await _service.StopSideAsync(_anna, Guid.NewGuid(), At(1)), Is.InstanceOf<BreastfeedResult.NotFound>());
        });
    }

    [Test]
    public async Task Stopping_ends_the_running_side_and_the_feed_is_no_longer_live()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10));

        var feed = FeedOf(await _service.StopSideAsync(_ben, feedId, At(3)));

        Assert.Multiple(() =>
        {
            Assert.That(feed.Segments.Single().EndedAt, Is.EqualTo(At(3)));
            Assert.That(feed.EndTime, Is.EqualTo(At(3)));
            Assert.That(Breastfeed.RunningSide(feed), Is.Null);
            Assert.That(feed.UpdatedByUserId, Is.EqualTo(_ben.Id));
        });
    }

    [Test]
    public async Task Stopping_when_no_side_runs_changes_nothing()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10));
        await _service.StopSideAsync(_anna, feedId, At(3));

        var feed = FeedOf(await _service.StopSideAsync(_anna, feedId, At(1)));

        Assert.That(feed.Segments.Single().EndedAt, Is.EqualTo(At(3)));
    }

    [Test]
    public async Task A_stopped_breastfeed_does_not_block_a_new_one()
    {
        await FinishedAsync("left", 1);

        var result = await StartAsync(Guid.NewGuid(), "right", At(0));

        Assert.That(result, Is.InstanceOf<BreastfeedResult.Created>());
    }

    [Test]
    public async Task Editing_a_live_breastfeed_changes_its_start_time_and_notes_and_keeps_its_side_running()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(10));
        await StartAsync(feedId, "right", At(6));

        var result = await _service.UpdateAsync(_ben, feedId, new FeedInput(null, At(12), " calm ", null, null));

        var feed = ((UpdateFeedResult.Updated)result).Entry.Feed;
        Assert.Multiple(() =>
        {
            Assert.That(feed.StartTime, Is.EqualTo(At(12)));
            Assert.That(feed.Notes, Is.EqualTo("calm"));
            Assert.That(feed.EndTime, Is.Null);
            Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Right));
            Assert.That(feed.Segments, Has.Count.EqualTo(2));
            Assert.That(feed.UpdatedByUserId, Is.EqualTo(_ben.Id));
        });
    }

    [Test]
    public async Task Editing_a_saved_breastfeed_changes_its_start_time_and_notes()
    {
        var feedId = await FinishedAsync("left", 30);

        var result = await _service.UpdateAsync(_ben, feedId, new FeedInput(null, At(40), "sleepy", null, null));

        var feed = ((UpdateFeedResult.Updated)result).Entry.Feed;
        Assert.Multiple(() =>
        {
            Assert.That(feed.StartTime, Is.EqualTo(At(40)));
            Assert.That(feed.Notes, Is.EqualTo("sleepy"));
            Assert.That(feed.Kind, Is.EqualTo(FeedKind.Breastfeed));
            Assert.That(feed.EndTime, Is.EqualTo(At(30)));
        });
    }

    [Test]
    public async Task A_saved_breastfeed_cannot_start_after_its_end()
    {
        var feedId = await FinishedAsync("left", 30);

        var result = await _service.UpdateAsync(_anna, feedId, new FeedInput(null, At(20), null, null, null));

        Assert.That(((UpdateFeedResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "afterEnd" }));
    }

    private static FeedInput Typed(int left, int right, string? endedOn, int startedMinutesAgo = 60, string? notes = null) =>
        new("breastfeed", At(startedMinutesAgo), notes, null, null, Durations: new BreastfeedDurations(left, right, endedOn));

    private static (BreastSide, DateTimeOffset, DateTimeOffset?)[] Spans(Feed feed) =>
        feed.Segments.Select(s => (s.Side, s.StartedAt, s.EndedAt)).ToArray();

    [Test]
    public async Task A_breastfeed_typed_by_hand_is_created_saved_with_its_segments()
    {
        var feedId = Guid.NewGuid();

        var result = await _service.CreateAsync(_anna, feedId, _lea.Id, Typed(300, 180, "left", notes: "calm"));

        var feed = ((CreateFeedResult.Created)result).Entry.Feed;
        Assert.Multiple(() =>
        {
            Assert.That(feed.Id, Is.EqualTo(feedId));
            Assert.That(feed.Kind, Is.EqualTo(FeedKind.Breastfeed));
            Assert.That(feed.StartTime, Is.EqualTo(At(60)));
            Assert.That(feed.EndTime, Is.EqualTo(At(60).AddSeconds(480)));
            Assert.That(feed.Notes, Is.EqualTo("calm"));
            Assert.That(feed.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(Spans(feed), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[]
            {
                (BreastSide.Right, At(60), At(60).AddSeconds(180)),
                (BreastSide.Left, At(60).AddSeconds(180), At(60).AddSeconds(480)),
            }));
        });
    }

    [Test]
    public async Task A_breastfeed_typed_by_hand_sent_again_is_returned_unchanged()
    {
        var feedId = Guid.NewGuid();
        await _service.CreateAsync(_anna, feedId, _lea.Id, Typed(300, 180, "left"));

        var result = await _service.CreateAsync(_anna, feedId, _lea.Id, Typed(60, 0, null));

        Assert.That(Breastfeed.SideDuration(((CreateFeedResult.AlreadyExists)result).Entry.Feed, BreastSide.Left, Now), Is.EqualTo(TimeSpan.FromSeconds(300)));
        Assert.That(_feeds.Feeds, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task A_breastfeed_created_without_durations_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, new FeedInput("breastfeed", At(10), null, null, null));

        Assert.That(((CreateFeedResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["durations"] = "required" }));
    }

    [Test]
    public async Task A_breastfeed_typed_by_hand_while_another_is_in_progress_is_still_created()
    {
        await StartAsync(Guid.NewGuid(), "left", At(5));

        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Typed(300, 0, null));

        Assert.That(result, Is.InstanceOf<CreateFeedResult.Created>());
    }

    [Test]
    public async Task Typed_durations_replace_the_segments_of_a_saved_breastfeed()
    {
        var feedId = await FinishedAsync("left", 30);

        var result = await _service.UpdateAsync(_ben, feedId, Typed(120, 240, "right", startedMinutesAgo: 40) with { Kind = null });

        var feed = ((UpdateFeedResult.Updated)result).Entry.Feed;
        Assert.Multiple(() =>
        {
            Assert.That(feed.StartTime, Is.EqualTo(At(40)));
            Assert.That(feed.EndTime, Is.EqualTo(At(40).AddSeconds(360)));
            Assert.That(feed.UpdatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(Spans(feed), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[]
            {
                (BreastSide.Left, At(40), At(40).AddSeconds(120)),
                (BreastSide.Right, At(40).AddSeconds(120), At(40).AddSeconds(360)),
            }));
        });
    }

    [Test]
    public async Task Typed_durations_keep_a_live_breastfeed_running_on_its_side()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(200));

        // Left typed at 15 min and Right at 2 min, now: the sheet sends the start time now − both sides.
        var result = await _service.UpdateAsync(_anna, feedId, Typed(900, 120, "right", startedMinutesAgo: 17));

        var feed = ((UpdateFeedResult.Updated)result).Entry.Feed;
        Assert.Multiple(() =>
        {
            Assert.That(feed.StartTime, Is.EqualTo(At(17)));
            Assert.That(feed.EndTime, Is.Null);
            Assert.That(Breastfeed.RunningSide(feed), Is.EqualTo(BreastSide.Left));
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Left, Now), Is.EqualTo(TimeSpan.FromMinutes(15)));
            Assert.That(Spans(feed), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[]
            {
                (BreastSide.Right, At(17), At(15)),
                (BreastSide.Left, At(15), null),
            }));
        });
    }

    [Test]
    public async Task Typed_durations_keep_the_running_side_open_when_the_other_side_is_at_zero()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "right", At(30));

        var result = await _service.UpdateAsync(_anna, feedId, Typed(0, 600, null, startedMinutesAgo: 10));

        var feed = ((UpdateFeedResult.Updated)result).Entry.Feed;
        Assert.Multiple(() =>
        {
            Assert.That(feed.EndTime, Is.Null);
            Assert.That(Spans(feed), Is.EqualTo(new (BreastSide, DateTimeOffset, DateTimeOffset?)[] { (BreastSide.Right, At(10), null) }));
        });
    }

    [Test]
    public async Task A_live_breastfeed_corrected_by_hand_can_switch_sides_and_stop()
    {
        var feedId = Guid.NewGuid();
        await StartAsync(feedId, "left", At(200));
        await _service.UpdateAsync(_anna, feedId, Typed(300, 0, null, startedMinutesAgo: 5));

        await StartAsync(feedId, "right", At(2));
        var result = await _service.StopSideAsync(_anna, feedId, Now);

        var feed = FeedOf(result);
        Assert.Multiple(() =>
        {
            Assert.That(feed.EndTime, Is.EqualTo(Now));
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Left, Now), Is.EqualTo(TimeSpan.FromMinutes(3)));
            Assert.That(Breastfeed.SideDuration(feed, BreastSide.Right, Now), Is.EqualTo(TimeSpan.FromMinutes(2)));
        });
    }

    [Test]
    public async Task Invalid_typed_durations_leave_the_breastfeed_unchanged()
    {
        var feedId = await FinishedAsync("left", 30);

        var result = await _service.UpdateAsync(_anna, feedId, Typed(0, 0, null, startedMinutesAgo: 35));

        Assert.Multiple(() =>
        {
            Assert.That(((UpdateFeedResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["durations"] = "zero" }));
            Assert.That(Breastfeed.SideDuration(_feeds.Feeds.Single(), BreastSide.Left, Now), Is.EqualTo(TimeSpan.FromMinutes(5)));
        });
    }

    [Test]
    public async Task A_breastfeed_typed_by_hand_gives_the_last_side()
    {
        await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Typed(300, 180, "left"));

        var state = ((BreastfeedStateResult.Found)await _service.GetBreastfeedStateAsync(_lea.Id)).State;

        Assert.That(state.LastSide, Is.EqualTo(BreastSide.Left));
    }

    [Test]
    public async Task The_breastfeed_state_gives_the_one_in_progress_and_the_last_side()
    {
        await FinishedAsync("right", 60);
        await FinishedAsync("left", 30);
        var current = Guid.NewGuid();
        await StartAsync(current, "right", At(5));

        var state = ((BreastfeedStateResult.Found)await _service.GetBreastfeedStateAsync(_lea.Id)).State;

        Assert.That(state.InProgress?.Feed.Id, Is.EqualTo(current));
        Assert.That(state.LastSide, Is.EqualTo(BreastSide.Left));
    }

    [Test]
    public async Task Every_breastfeed_in_progress_is_listed_with_its_segments()
    {
        var tom = new Baby { Id = Guid.NewGuid(), Name = "Tom", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(tom);
        await FinishedAsync("left", 30);
        var lea = Guid.NewGuid();
        await StartAsync(lea, "right", At(10));
        var toms = Guid.NewGuid();
        await _service.StartSideAsync(_ben, toms, tom.Id, Guid.NewGuid(), "left", At(4));

        var entries = await _service.ListInProgressBreastfeedsAsync();

        Assert.Multiple(() =>
        {
            Assert.That(entries.Select(e => e.Feed.Id), Is.EquivalentTo(new[] { lea, toms }));
            Assert.That(entries.Single(e => e.Feed.Id == toms).Feed.Segments, Has.Count.EqualTo(1));
        });
    }

    [Test]
    public async Task The_breastfeed_state_is_empty_without_a_breastfeed()
    {
        var state = ((BreastfeedStateResult.Found)await _service.GetBreastfeedStateAsync(_lea.Id)).State;

        Assert.That(state, Is.EqualTo(new BreastfeedState(null, null)));
    }

    [Test]
    public async Task The_breastfeed_state_of_an_unknown_baby_is_refused() =>
        Assert.That(await _service.GetBreastfeedStateAsync(Guid.NewGuid()), Is.InstanceOf<BreastfeedStateResult.BabyNotFound>());
}
