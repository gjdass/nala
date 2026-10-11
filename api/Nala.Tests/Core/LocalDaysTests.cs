using Nala.Core.Trends;

namespace Nala.Tests.Core;

public class LocalDaysTests
{
    private static readonly TimeZoneInfo Paris = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");
    private static readonly TimeZoneInfo NewYork = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

    /// <summary>A Paris local time in September 2026 (UTC+2).</summary>
    private static DateTimeOffset ParisTime(int day, int hour, int minute = 0) => new(2026, 9, day, hour, minute, 0, TimeSpan.FromHours(2));

    [Test]
    public void A_span_within_one_local_day_counts_on_that_day()
    {
        var pieces = LocalDays.Split(ParisTime(10, 13), ParisTime(10, 14, 30), Paris).ToList();

        Assert.That(pieces, Has.Count.EqualTo(1));
        Assert.That(pieces[0].Date, Is.EqualTo(new DateOnly(2026, 9, 10)));
        Assert.That(pieces[0].Duration, Is.EqualTo(TimeSpan.FromMinutes(90)));
    }

    [Test]
    public void A_span_crossing_local_midnight_is_split_across_both_days()
    {
        var pieces = LocalDays.Split(ParisTime(10, 23), ParisTime(11, 1, 30), Paris).ToList();

        Assert.That(pieces.Select(p => (p.Date, p.Duration)), Is.EqualTo(new[]
        {
            (new DateOnly(2026, 9, 10), TimeSpan.FromHours(1)),
            (new DateOnly(2026, 9, 11), TimeSpan.FromMinutes(90)),
        }));
        Assert.That(pieces[0].To, Is.EqualTo(ParisTime(11, 0)));
        Assert.That(pieces[1].From, Is.EqualTo(ParisTime(11, 0)));
    }

    [Test]
    public void Days_follow_the_zone_not_utc()
    {
        // 21:00 to 23:00 in New York (UTC-4) is 01:00 to 03:00 UTC the next day.
        var start = new DateTimeOffset(2026, 9, 10, 21, 0, 0, TimeSpan.FromHours(-4));

        var pieces = LocalDays.Split(start, start.AddHours(2), NewYork).ToList();

        Assert.That(pieces.Single().Date, Is.EqualTo(new DateOnly(2026, 9, 10)));
        Assert.That(LocalDays.DateOf(start, NewYork), Is.EqualTo(new DateOnly(2026, 9, 10)));
        Assert.That(LocalDays.DateOf(start, Paris), Is.EqualTo(new DateOnly(2026, 9, 11)));
    }

    [Test]
    public void A_dst_day_is_23_or_25_hours_long()
    {
        var spring = new DateOnly(2026, 3, 29);
        var autumn = new DateOnly(2026, 10, 25);

        Assert.That(LocalDays.StartUtc(spring.AddDays(1), Paris) - LocalDays.StartUtc(spring, Paris), Is.EqualTo(TimeSpan.FromHours(23)));
        Assert.That(LocalDays.StartUtc(autumn.AddDays(1), Paris) - LocalDays.StartUtc(autumn, Paris), Is.EqualTo(TimeSpan.FromHours(25)));
        var pieces = LocalDays.Split(LocalDays.StartUtc(autumn, Paris), LocalDays.StartUtc(autumn.AddDays(1), Paris), Paris).ToList();
        Assert.That(pieces.Single().Duration, Is.EqualTo(TimeSpan.FromHours(25)));
    }

    [Test]
    public void Local_time_converts_to_utc_with_dst_gaps_moved_forward_and_overlaps_taking_the_first()
    {
        Assert.Multiple(() =>
        {
            Assert.That(LocalDays.ToUtc(new DateOnly(2026, 9, 10), new TimeOnly(19, 0), Paris), Is.EqualTo(ParisTime(10, 19)));
            Assert.That(LocalDays.StartUtc(new DateOnly(2026, 9, 10), Paris), Is.EqualTo(new DateTimeOffset(2026, 9, 9, 22, 0, 0, TimeSpan.Zero)));
            // 02:30 doesn't exist on 29 March in Paris (02:00 → 03:00): the first valid instant after it is 03:00 CEST, 01:00 UTC.
            Assert.That(LocalDays.ToUtc(new DateOnly(2026, 3, 29), new TimeOnly(2, 30), Paris), Is.EqualTo(new DateTimeOffset(2026, 3, 29, 1, 0, 0, TimeSpan.Zero)));
            // 02:30 happens twice on 25 October in Paris: the first one is CEST, 00:30 UTC.
            Assert.That(LocalDays.ToUtc(new DateOnly(2026, 10, 25), new TimeOnly(2, 30), Paris), Is.EqualTo(new DateTimeOffset(2026, 10, 25, 0, 30, 0, TimeSpan.Zero)));
        });
    }
}
