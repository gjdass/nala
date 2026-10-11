using Nala.Core.Babies;
using Nala.Core.Diapers;
using Nala.Core.Families;
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
        _families = new FakeFamilyRepository();
        _babies = new FakeBabyRepository(_families);
        _service = new TrendService(_sleeps, _diapers, _pumps, new FamilyAccess(_families, _babies), new FixedTimeProvider(Now));
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

    /// <summary>A section's trends, whatever their day type.</summary>
    private async Task<object> TrendsAsync(string section, Guid babyId, string from, string to, string tz) => section switch
    {
        "sleeps" => await _service.SleepsAsync(_anna, babyId, from, to, tz),
        "diapers" => await _service.DiapersAsync(_anna, babyId, from, to, tz),
        _ => await _service.PumpsAsync(_anna, babyId, from, to, tz),
    };

    [TestCase("sleeps")]
    [TestCase("diapers")]
    [TestCase("pumps")]
    public async Task Invalid_parameters_return_their_codes(string section)
    {
        var result = await TrendsAsync(section, _lea.Id, "2026-09-10", "2026-09-01", "Mars/Olympus");

        var errors = result switch
        {
            TrendResult<SleepTrendDay>.Invalid i => i.Errors,
            TrendResult<DiaperTrendDay>.Invalid i => i.Errors,
            TrendResult<PumpTrendDay>.Invalid i => i.Errors,
            _ => null,
        };
        Assert.That(errors,
            Is.EqualTo(new Dictionary<string, string> { ["to"] = "beforeFrom", ["tz"] = "invalid" }));
    }

    [TestCase("sleeps")]
    [TestCase("diapers")]
    [TestCase("pumps")]
    public async Task Another_familys_or_an_unknown_baby_is_not_found(string section)
    {
        AddSleep(At(10, 13), At(10, 14), _max);
        AddDiaper(At(10, 13), wet: true, dirty: false, _max);
        AddPump(At(10, 13), At(10, 14), 50, 50, _max);

        foreach (var babyId in new[] { _max.Id, Guid.NewGuid() })
        {
            var result = await TrendsAsync(section, babyId, "2026-09-01", "2026-09-30", "Europe/Paris");

            Assert.That(result.GetType().Name, Is.EqualTo("BabyNotFound"));
        }
    }
}
