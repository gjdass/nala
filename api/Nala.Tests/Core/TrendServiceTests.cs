using Nala.Core.Babies;
using Nala.Core.Diapers;
using Nala.Core.Families;
using Nala.Core.Feeds;
using Nala.Core.GrowthEntries;
using Nala.Core.Pumps;
using Nala.Core.Sleeps;
using Nala.Core.Trends;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class TrendServiceTests
{
    /// <summary>14:00 in Paris (UTC+2).</summary>
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private FakeSleepRepository _sleeps = null!;
    private FakeDiaperRepository _diapers = null!;
    private FakePumpRepository _pumps = null!;
    private FakeFeedRepository _feeds = null!;
    private FakeGrowthEntryRepository _growth = null!;
    private FakeFamilyRepository _families = null!;
    private FakeBabyRepository _babies = null!;
    private TrendService _service = null!;
    private User _anna = null!;
    private User _carl = null!;
    private Baby _lea = null!;
    private Baby _tom = null!;
    private Baby _max = null!;

    [SetUp]
    public void SetUp()
    {
        _sleeps = new FakeSleepRepository();
        _diapers = new FakeDiaperRepository();
        _pumps = new FakePumpRepository();
        _feeds = new FakeFeedRepository();
        _growth = new FakeGrowthEntryRepository();
        _families = new FakeFamilyRepository();
        _babies = new FakeBabyRepository(_families);
        _service = new TrendService(_sleeps, _diapers, _pumps, _feeds, _growth, new FamilyAccess(_families, _babies), new FixedTimeProvider(Now));
        _anna = new User { Id = Guid.NewGuid(), DisplayName = "Anna", PreferredLanguage = "en" };
        _carl = new User { Id = Guid.NewGuid(), DisplayName = "Carl", PreferredLanguage = "en" };
        var martins = _families.Seed("Martins", Now, _anna);
        var others = _families.Seed("Others", Now, _carl);
        _lea = NewBaby(martins, "Lea");
        _tom = NewBaby(martins, "Tom");
        _max = NewBaby(others, "Max");
    }

    private Baby NewBaby(Family family, string name)
    {
        var baby = new Baby { Id = Guid.NewGuid(), FamilyId = family.Id, Name = name, BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(baby);
        return baby;
    }

    /// <summary>A Paris local time in September 2026 (UTC+2).</summary>
    private static DateTimeOffset At(int day, int hour, int minute = 0) => new(2026, 9, day, hour, minute, 0, TimeSpan.FromHours(2));

    private void AddSleep(DateTimeOffset start, DateTimeOffset? end, Baby? baby = null) => _sleeps.Sleeps.Add(new Sleep
    {
        Id = Guid.NewGuid(),
        BabyId = (baby ?? _lea).Id,
        StartTime = start,
        EndTime = end,
        LoggedByUserId = _anna.Id,
        UpdatedByUserId = _anna.Id,
        CreatedAt = Now,
        UpdatedAt = Now,
    });

    private async Task<IReadOnlyList<SleepTrendDay>> DaysAsync(string from = "2026-09-01", string to = "2026-09-30") =>
        ((TrendResult<SleepTrendDay>.Days)await _service.SleepsAsync(_anna, _lea.Id, from, to, "Europe/Paris")).Items;

    private static long Hours(double hours) => (long)(hours * 3600);

    [Test]
    public async Task Sleep_minutes_between_19_and_7_local_count_as_night_others_as_day()
    {
        AddSleep(At(10, 18), At(10, 20));
        AddSleep(At(10, 6), At(10, 8));
        AddSleep(At(10, 13), At(10, 14, 30));

        var days = await DaysAsync();

        Assert.That(days, Is.EqualTo(new[] { new SleepTrendDay(new DateOnly(2026, 9, 10), Hours(3.5), Hours(2), Hours(2)) }));
    }

    [Test]
    public async Task A_sleep_crossing_midnight_splits_its_night_across_both_days()
    {
        AddSleep(At(10, 21), At(11, 6, 30));

        var days = await DaysAsync();

        Assert.That(days, Is.EqualTo(new[]
        {
            new SleepTrendDay(new DateOnly(2026, 9, 10), 0, Hours(3), Hours(9.5)),
            new SleepTrendDay(new DateOnly(2026, 9, 11), 0, Hours(6.5), null),
        }));
    }

    [Test]
    public async Task The_longest_sleep_counts_its_whole_duration_on_its_start_day()
    {
        AddSleep(At(12, 10), At(12, 11));
        AddSleep(At(12, 22), At(13, 5));
        AddSleep(At(13, 9), At(13, 12));

        var days = await DaysAsync();

        Assert.That(days.Select(d => (d.Date, d.LongestSeconds)), Is.EqualTo(new[]
        {
            (new DateOnly(2026, 9, 12), (long?)Hours(7)),
            (new DateOnly(2026, 9, 13), (long?)Hours(3)),
        }));
    }

    [Test]
    public async Task A_day_reached_only_by_the_previous_night_has_no_longest()
    {
        // Starts the day before the range: only its part inside the range counts, and its longest stays outside.
        AddSleep(At(3, 20), At(4, 7, 30));

        var days = await DaysAsync(from: "2026-09-04", to: "2026-09-10");

        Assert.That(days, Is.EqualTo(new[] { new SleepTrendDay(new DateOnly(2026, 9, 4), Hours(0.5), Hours(7), null) }));
    }

    [Test]
    public async Task A_live_sleep_counts_up_to_now()
    {
        AddSleep(At(30, 12, 30), null);

        var days = await DaysAsync();

        Assert.That(days, Is.EqualTo(new[] { new SleepTrendDay(new DateOnly(2026, 9, 30), Hours(1.5), 0, Hours(1.5)) }));
    }

    [Test]
    public async Task A_live_sleep_starting_in_the_future_has_no_duration_yet()
    {
        AddSleep(At(30, 15), null);

        Assert.That(await DaysAsync(), Is.Empty);
    }

    [Test]
    public async Task Only_data_days_in_the_range_are_returned_in_date_order()
    {
        AddSleep(At(8, 13), At(8, 14));
        AddSleep(At(5, 13), At(5, 14));
        AddSleep(At(2, 13), At(2, 14));
        AddSleep(At(11, 13), At(11, 14));
        AddSleep(At(10, 23), At(11, 1));
        AddSleep(At(6, 13), At(6, 14), _tom);

        var days = await DaysAsync(from: "2026-09-04", to: "2026-09-10");

        Assert.That(days.Select(d => d.Date), Is.EqualTo(new[] { new DateOnly(2026, 9, 5), new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 10) }));
        Assert.That(days[^1], Is.EqualTo(new SleepTrendDay(new DateOnly(2026, 9, 10), 0, Hours(1), Hours(2))));
    }

    private void AddDiaper(DateTimeOffset time, bool wet, bool dirty, Baby? baby = null) => _diapers.Diapers.Add(new Diaper
    {
        Id = Guid.NewGuid(),
        BabyId = (baby ?? _lea).Id,
        Time = time,
        Wet = wet,
        Dirty = dirty,
        LoggedByUserId = _anna.Id,
        UpdatedByUserId = _anna.Id,
        CreatedAt = Now,
        UpdatedAt = Now,
    });

    private async Task<IReadOnlyList<DiaperTrendDay>> DiaperDaysAsync(string from = "2026-09-01", string to = "2026-09-30") =>
        ((TrendResult<DiaperTrendDay>.Days)await _service.DiapersAsync(_anna, _lea.Id, from, to, "Europe/Paris")).Items;

    [Test]
    public async Task Diapers_count_wet_dirty_and_all_per_local_day_of_their_time()
    {
        AddDiaper(At(10, 8), wet: true, dirty: true);
        AddDiaper(At(10, 12), wet: true, dirty: false);
        AddDiaper(At(10, 16), wet: false, dirty: false);
        // 00:30 in Paris is still the 10th in UTC: it belongs to the 11th.
        AddDiaper(At(11, 0, 30), wet: false, dirty: true);

        Assert.That(await DiaperDaysAsync(), Is.EqualTo(new[]
        {
            new DiaperTrendDay(new DateOnly(2026, 9, 10), 2, 1, 3),
            new DiaperTrendDay(new DateOnly(2026, 9, 11), 0, 1, 1),
        }));
    }

    [Test]
    public async Task A_day_with_only_dry_diapers_is_a_data_day_with_zero_wet_and_dirty()
    {
        AddDiaper(At(12, 9), wet: false, dirty: false);

        Assert.That(await DiaperDaysAsync(), Is.EqualTo(new[] { new DiaperTrendDay(new DateOnly(2026, 9, 12), 0, 0, 1) }));
    }

    [Test]
    public async Task Only_the_babys_diapers_in_the_range_are_returned_in_date_order()
    {
        AddDiaper(At(8, 9), wet: true, dirty: false);
        AddDiaper(At(5, 9), wet: true, dirty: false);
        AddDiaper(At(3, 23, 59), wet: true, dirty: false);
        AddDiaper(At(11, 0), wet: true, dirty: false);
        AddDiaper(At(6, 9), wet: true, dirty: false, _tom);

        var days = await DiaperDaysAsync(from: "2026-09-04", to: "2026-09-10");

        Assert.That(days.Select(d => d.Date), Is.EqualTo(new[] { new DateOnly(2026, 9, 5), new DateOnly(2026, 9, 8) }));
    }

    private void AddPump(DateTimeOffset start, DateTimeOffset? end, int? leftMl, int? rightMl, Baby? baby = null) => _pumps.Pumps.Add(new Pump
    {
        Id = Guid.NewGuid(),
        BabyId = (baby ?? _lea).Id,
        StartTime = start,
        EndTime = end,
        LeftMl = leftMl,
        RightMl = rightMl,
        LoggedByUserId = _anna.Id,
        UpdatedByUserId = _anna.Id,
        CreatedAt = Now,
        UpdatedAt = Now,
    });

    private async Task<IReadOnlyList<PumpTrendDay>> PumpDaysAsync(string from = "2026-09-01", string to = "2026-09-30") =>
        ((TrendResult<PumpTrendDay>.Days)await _service.PumpsAsync(_anna, _lea.Id, from, to, "Europe/Paris")).Items;

    [Test]
    public async Task Pump_volumes_and_sessions_go_to_the_start_day()
    {
        AddPump(At(10, 9), At(10, 9, 20), 90, 80);
        AddPump(At(10, 23, 50), At(11, 0, 15), 60, null);
        AddPump(At(11, 9), At(11, 9, 20), null, null);

        Assert.That(await PumpDaysAsync(), Is.EqualTo(new[]
        {
            new PumpTrendDay(new DateOnly(2026, 9, 10), 150, 80, 2),
            new PumpTrendDay(new DateOnly(2026, 9, 11), 0, 0, 1),
        }));
    }

    [Test]
    public async Task A_live_pump_session_counts_on_its_start_day()
    {
        AddPump(At(30, 13, 50), null, 40, 30);

        Assert.That(await PumpDaysAsync(), Is.EqualTo(new[] { new PumpTrendDay(new DateOnly(2026, 9, 30), 40, 30, 1) }));
    }

    [Test]
    public async Task Only_the_babys_pump_sessions_starting_in_the_range_are_returned()
    {
        AddPump(At(3, 23, 50), At(4, 0, 20), 50, 50);
        AddPump(At(7, 9), At(7, 9, 20), 50, 50);
        AddPump(At(11, 0), At(11, 0, 20), 50, 50);
        AddPump(At(6, 9), At(6, 9, 20), 50, 50, _tom);

        var days = await PumpDaysAsync(from: "2026-09-04", to: "2026-09-10");

        Assert.That(days.Select(d => d.Date), Is.EqualTo(new[] { new DateOnly(2026, 9, 7) }));
    }

    private Feed AddFeed(FeedKind kind, DateTimeOffset start, Baby? baby, DateTimeOffset? end = null, MilkType? milkType = null, int? amountMl = null)
    {
        var feed = new Feed
        {
            Id = Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            Kind = kind,
            StartTime = start,
            EndTime = end,
            MilkType = milkType,
            AmountMl = amountMl,
            Food = kind == FeedKind.Solids ? "Carrot" : null,
            LoggedByUserId = _anna.Id,
            UpdatedByUserId = _anna.Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        _feeds.Feeds.Add(feed);
        return feed;
    }

    private void AddBottle(DateTimeOffset start, MilkType milkType, int amountMl, Baby? baby = null) =>
        AddFeed(FeedKind.Bottle, start, baby, milkType: milkType, amountMl: amountMl);

    private void AddSolids(DateTimeOffset start) => AddFeed(FeedKind.Solids, start, null);

    /// <summary>A breastfeed with its sides' segments, each from and to an instant (null: still running); live when one runs.</summary>
    private void AddBreastfeed(DateTimeOffset start, params (BreastSide Side, DateTimeOffset From, DateTimeOffset? To)[] segments)
    {
        var live = segments.Any(s => s.To is null);
        var feed = AddFeed(FeedKind.Breastfeed, start, null, end: live ? null : segments.Max(s => s.To));
        feed.Segments.AddRange(segments.Select(s => new BreastFeedSegment
        {
            Id = Guid.NewGuid(),
            FeedId = feed.Id,
            Side = s.Side,
            StartedAt = s.From,
            EndedAt = s.To,
        }));
    }

    private async Task<IReadOnlyList<FeedTrendDay>> FeedDaysAsync(string from = "2026-09-01", string to = "2026-09-30") =>
        ((TrendResult<FeedTrendDay>.Days)await _service.FeedsAsync(_anna, _lea.Id, from, to, "Europe/Paris")).Items;

    private static FeedTrendDay FeedDay(
        int day, (int Breastfeed, int Bottle, int Solids) count = default, (int BreastMilk, int Formula) bottleMl = default,
        (long Left, long Right) breast = default, long gapSecondsSum = 0, int gapCount = 0) =>
        new(new DateOnly(2026, 9, day),
            new FeedKindCounts(count.Breastfeed, count.Bottle, count.Solids),
            new BottleMl(bottleMl.BreastMilk, bottleMl.Formula),
            new BreastSeconds(breast.Left, breast.Right),
            gapSecondsSum, gapCount);

    [Test]
    public async Task Feeds_count_by_kind_and_bottle_ml_by_milk_type_on_their_start_day()
    {
        AddBottle(At(10, 23, 50), MilkType.Formula, 120);
        AddBottle(At(10, 15), MilkType.BreastMilk, 90);
        AddSolids(At(10, 12));
        AddBreastfeed(At(11, 9), (BreastSide.Left, At(11, 9), At(11, 9, 10)));

        Assert.That(await FeedDaysAsync(), Is.EqualTo(new[]
        {
            FeedDay(10, count: (0, 2, 1), bottleMl: (90, 120), gapSecondsSum: 3 * 3600, gapCount: 1),
            FeedDay(11, count: (1, 0, 0), breast: (600, 0)),
        }));
    }

    [Test]
    public async Task Breast_seconds_are_summed_per_side_from_the_segments()
    {
        AddBreastfeed(At(10, 9),
            (BreastSide.Left, At(10, 9), At(10, 9, 5)),
            (BreastSide.Right, At(10, 9, 5), At(10, 9, 12)),
            (BreastSide.Left, At(10, 9, 12), At(10, 9, 15)));

        Assert.That(await FeedDaysAsync(), Is.EqualTo(new[] { FeedDay(10, count: (1, 0, 0), breast: (8 * 60, 7 * 60)) }));
    }

    [Test]
    public async Task A_breast_side_crossing_midnight_splits_across_both_days()
    {
        AddBreastfeed(At(10, 23, 50),
            (BreastSide.Left, At(10, 23, 50), At(10, 23, 58)),
            (BreastSide.Right, At(10, 23, 58), At(11, 0, 6)));

        Assert.That(await FeedDaysAsync(), Is.EqualTo(new[]
        {
            FeedDay(10, count: (1, 0, 0), breast: (8 * 60, 2 * 60)),
            FeedDay(11, breast: (0, 6 * 60)),
        }));
    }

    [Test]
    public async Task A_running_breast_side_counts_up_to_now()
    {
        AddBreastfeed(At(30, 13, 30), (BreastSide.Left, At(30, 13, 30), At(30, 13, 40)), (BreastSide.Right, At(30, 13, 40), null));

        Assert.That(await FeedDaysAsync(), Is.EqualTo(new[] { FeedDay(30, count: (1, 0, 0), breast: (10 * 60, 20 * 60)) }));
    }

    [Test]
    public async Task Gaps_count_on_the_later_feeds_day_and_ignore_gaps_over_8_hours()
    {
        AddBottle(At(10, 20), MilkType.Formula, 100);
        AddBottle(At(11, 4), MilkType.Formula, 100);
        AddBottle(At(11, 6, 30), MilkType.Formula, 100);
        AddBottle(At(11, 14, 31), MilkType.Formula, 100);
        AddBottle(At(13, 9), MilkType.Formula, 100);

        var days = await FeedDaysAsync();

        Assert.That(days.Select(d => (d.Date.Day, d.GapSecondsSum, d.GapCount)), Is.EqualTo(new[]
        {
            (10, 0L, 0),
            (11, 8 * 3600L + 150 * 60, 2),
            (13, 0L, 0),
        }));
    }

    [Test]
    public async Task A_feed_before_the_range_gives_the_first_day_its_gap()
    {
        AddBottle(At(9, 22), MilkType.Formula, 100);
        AddBottle(At(10, 1), MilkType.Formula, 100);

        var days = await FeedDaysAsync(from: "2026-09-10", to: "2026-09-16");

        Assert.That(days, Is.EqualTo(new[] { FeedDay(10, count: (0, 1, 0), bottleMl: (0, 100), gapSecondsSum: 3 * 3600, gapCount: 1) }));
    }

    [Test]
    public async Task Feeds_of_another_baby_or_outside_the_range_are_left_out()
    {
        AddBottle(At(3, 12), MilkType.Formula, 100);
        AddBottle(At(7, 12), MilkType.Formula, 100, _tom);
        AddBottle(At(11, 0, 30), MilkType.Formula, 100);
        AddBottle(At(8, 12), MilkType.Formula, 100);

        var days = await FeedDaysAsync(from: "2026-09-04", to: "2026-09-10");

        Assert.That(days, Is.EqualTo(new[] { FeedDay(8, count: (0, 1, 0), bottleMl: (0, 100)) }));
    }

    /// <summary>A section's trends, whatever their day type.</summary>
    private async Task<object> TrendsAsync(string section, Guid babyId, string from, string to, string tz) => section switch
    {
        "sleeps" => await _service.SleepsAsync(_anna, babyId, from, to, tz),
        "diapers" => await _service.DiapersAsync(_anna, babyId, from, to, tz),
        "pumps" => await _service.PumpsAsync(_anna, babyId, from, to, tz),
        _ => await _service.FeedsAsync(_anna, babyId, from, to, tz),
    };

    [TestCase("sleeps")]
    [TestCase("diapers")]
    [TestCase("pumps")]
    [TestCase("feeds")]
    public async Task Invalid_parameters_return_their_codes(string section)
    {
        var result = await TrendsAsync(section, _lea.Id, "2026-09-10", "2026-09-01", "Mars/Olympus");

        var errors = result switch
        {
            TrendResult<SleepTrendDay>.Invalid i => i.Errors,
            TrendResult<DiaperTrendDay>.Invalid i => i.Errors,
            TrendResult<PumpTrendDay>.Invalid i => i.Errors,
            TrendResult<FeedTrendDay>.Invalid i => i.Errors,
            _ => null,
        };
        Assert.That(errors,
            Is.EqualTo(new Dictionary<string, string> { ["to"] = "beforeFrom", ["tz"] = "invalid" }));
    }

    [TestCase("sleeps")]
    [TestCase("diapers")]
    [TestCase("pumps")]
    [TestCase("feeds")]
    public async Task Another_familys_or_an_unknown_baby_is_not_found(string section)
    {
        AddSleep(At(10, 13), At(10, 14), _max);
        AddDiaper(At(10, 13), wet: true, dirty: false, _max);
        AddPump(At(10, 13), At(10, 14), 50, 50, _max);
        AddBottle(At(10, 13), MilkType.Formula, 120, _max);

        foreach (var babyId in new[] { _max.Id, Guid.NewGuid() })
        {
            var result = await TrendsAsync(section, babyId, "2026-09-01", "2026-09-30", "Europe/Paris");

            Assert.That(result.GetType().Name, Is.EqualTo("BabyNotFound"));
        }
    }

    private GrowthEntry AddGrowth(
        int month, int day, int? weightG = null, decimal? lengthCm = null, decimal? headCm = null,
        GrowthMilestone? milestone = null, string? title = null, Baby? baby = null, int createdMinute = 0)
    {
        var entry = new GrowthEntry
        {
            Id = Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            Kind = milestone is null ? GrowthKind.Measurement : GrowthKind.Milestone,
            Date = new DateOnly(2026, month, day),
            WeightG = weightG,
            LengthCm = lengthCm,
            HeadCircumferenceCm = headCm,
            Milestone = milestone,
            Title = title,
            LoggedByUserId = _anna.Id,
            UpdatedByUserId = _anna.Id,
            CreatedAt = Now.AddMinutes(createdMinute),
            UpdatedAt = Now,
        };
        _growth.GrowthEntries.Add(entry);
        return entry;
    }

    private async Task<GrowthTrends> GrowthAsync(string from, string to) =>
        ((GrowthTrendResult.Found)await _service.GrowthAsync(_anna, _lea.Id, from, to)).Trends;

    [Test]
    public async Task Growth_returns_the_measurements_in_range_in_date_order()
    {
        AddGrowth(9, 30, weightG: 4800);
        AddGrowth(9, 10, weightG: 3900, createdMinute: 2);
        AddGrowth(9, 10, lengthCm: 52.5m, createdMinute: 1);
        AddGrowth(9, 5, weightG: 3600);
        AddGrowth(10, 1, weightG: 5000);
        AddGrowth(9, 20, weightG: 4400, baby: _tom);

        var trends = await GrowthAsync("2026-09-10", "2026-09-30");

        Assert.That(trends.Measurements, Is.EqualTo(new[]
        {
            new GrowthTrendPoint(new DateOnly(2026, 9, 10), null, 52.5m, null, false),
            new GrowthTrendPoint(new DateOnly(2026, 9, 10), 3900, null, null, false),
            new GrowthTrendPoint(new DateOnly(2026, 9, 30), 4800, null, null, false),
        }));
    }

    [Test]
    public async Task Growth_puts_the_birth_measurement_first_when_the_birth_date_is_in_range()
    {
        _lea.BirthWeightG = 3400;
        _lea.BirthHeadCircumferenceCm = 34.5m;
        AddGrowth(9, 1, weightG: 3350);

        var trends = await GrowthAsync("2026-09-01", "2026-09-30");

        Assert.That(trends.Measurements, Is.EqualTo(new[]
        {
            new GrowthTrendPoint(new DateOnly(2026, 9, 1), 3400, null, 34.5m, true),
            new GrowthTrendPoint(new DateOnly(2026, 9, 1), 3350, null, null, false),
        }));
    }

    [Test]
    public async Task Growth_has_no_birth_point_outside_the_range_or_without_birth_measurements()
    {
        Assert.That((await GrowthAsync("2026-09-01", "2026-09-30")).Measurements, Is.Empty);

        _lea.BirthWeightG = 3400;
        Assert.That((await GrowthAsync("2026-09-02", "2026-09-30")).Measurements, Is.Empty);
    }

    [Test]
    public async Task Growth_returns_the_milestones_in_range_with_their_titles()
    {
        AddGrowth(9, 20, milestone: GrowthMilestone.Custom, title: "Grabs a toy");
        AddGrowth(9, 12, milestone: GrowthMilestone.FirstSmile);
        AddGrowth(10, 2, milestone: GrowthMilestone.FirstLaugh);
        AddGrowth(9, 15, milestone: GrowthMilestone.RollsOver, baby: _tom);

        var trends = await GrowthAsync("2026-09-01", "2026-09-30");

        Assert.That(trends.Milestones, Is.EqualTo(new[]
        {
            new GrowthTrendMilestone(new DateOnly(2026, 9, 12), GrowthMilestone.FirstSmile, null),
            new GrowthTrendMilestone(new DateOnly(2026, 9, 20), GrowthMilestone.Custom, "Grabs a toy"),
        }));
        Assert.That(trends.Measurements, Is.Empty);
    }

    [Test]
    public async Task Growth_checks_from_and_to_then_the_baby()
    {
        var invalid = (GrowthTrendResult.Invalid)await _service.GrowthAsync(_anna, Guid.NewGuid(), "2026-09-10", "2026-09-01");
        Assert.That(invalid.Errors, Is.EqualTo(new Dictionary<string, string> { ["to"] = "beforeFrom" }));

        invalid = (GrowthTrendResult.Invalid)await _service.GrowthAsync(_anna, _lea.Id, null, "2026-9-1");
        Assert.That(invalid.Errors, Is.EqualTo(new Dictionary<string, string> { ["from"] = "required", ["to"] = "invalid" }));

        foreach (var babyId in new[] { _max.Id, Guid.NewGuid() })
        {
            Assert.That(await _service.GrowthAsync(_anna, babyId, "2026-09-01", "2026-09-30"), Is.InstanceOf<GrowthTrendResult.BabyNotFound>());
        }
    }
}
