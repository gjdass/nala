using Nala.Core.Babies;
using Nala.Core.Families;
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
        _families = new FakeFamilyRepository();
        _babies = new FakeBabyRepository(_families);
        _service = new TrendService(_sleeps, new FamilyAccess(_families, _babies), new FixedTimeProvider(Now));
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

    [Test]
    public async Task Invalid_parameters_return_their_codes()
    {
        var result = await _service.SleepsAsync(_anna, _lea.Id, "2026-09-10", "2026-09-01", "Mars/Olympus");

        Assert.That(((TrendResult<SleepTrendDay>.Invalid)result).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["to"] = "beforeFrom", ["tz"] = "invalid" }));
    }

    [Test]
    public async Task Another_familys_or_an_unknown_baby_is_not_found()
    {
        AddSleep(At(10, 13), At(10, 14), _max);

        Assert.That(await _service.SleepsAsync(_anna, _max.Id, "2026-09-01", "2026-09-30", "Europe/Paris"),
            Is.InstanceOf<TrendResult<SleepTrendDay>.BabyNotFound>());
        Assert.That(await _service.SleepsAsync(_anna, Guid.NewGuid(), "2026-09-01", "2026-09-30", "Europe/Paris"),
            Is.InstanceOf<TrendResult<SleepTrendDay>.BabyNotFound>());
    }
}
