using Nala.Core.Trends;

namespace Nala.Tests.Core;

public class TrendRangeTests
{
    private static (TrendRange? Range, Dictionary<string, string> Errors) Parse(string? from, string? to, string? tz)
    {
        var errors = new Dictionary<string, string>();
        return (TrendRange.Parse(from, to, tz, errors), errors);
    }

    [Test]
    public void Valid_dates_and_zone_give_the_utc_bounds_of_the_local_days()
    {
        var (range, errors) = Parse("2026-09-04", "2026-09-10", "Europe/Paris");

        Assert.That(errors, Is.Empty);
        Assert.Multiple(() =>
        {
            Assert.That(range!.From, Is.EqualTo(new DateOnly(2026, 9, 4)));
            Assert.That(range.To, Is.EqualTo(new DateOnly(2026, 9, 10)));
            Assert.That(range.Zone.Id, Is.EqualTo("Europe/Paris"));
            Assert.That(range.StartUtc, Is.EqualTo(new DateTimeOffset(2026, 9, 3, 22, 0, 0, TimeSpan.Zero)));
            Assert.That(range.EndUtc, Is.EqualTo(new DateTimeOffset(2026, 9, 10, 22, 0, 0, TimeSpan.Zero)));
        });
    }

    [Test]
    public void A_single_day_range_is_valid()
    {
        var (range, errors) = Parse("2026-09-10", "2026-09-10", "UTC");

        Assert.That(errors, Is.Empty);
        Assert.That(range!.EndUtc - range.StartUtc, Is.EqualTo(TimeSpan.FromDays(1)));
    }

    [Test]
    public void Missing_values_are_required()
    {
        var (range, errors) = Parse(null, " ", "");

        Assert.That(range, Is.Null);
        Assert.That(errors, Is.EqualTo(new Dictionary<string, string> { ["from"] = "required", ["to"] = "required", ["tz"] = "required" }));
    }

    [TestCase("2026-1-5")]
    [TestCase("2026-02-30")]
    [TestCase("10/09/2026")]
    [TestCase("2026-09-10T00:00")]
    public void Malformed_dates_are_invalid(string date)
    {
        var (range, errors) = Parse(date, date, "Europe/Paris");

        Assert.That(range, Is.Null);
        Assert.That(errors, Is.EqualTo(new Dictionary<string, string> { ["from"] = "invalid", ["to"] = "invalid" }));
    }

    [TestCase("Mars/Olympus")]
    [TestCase("not a zone")]
    public void Unknown_zones_are_invalid(string tz)
    {
        var (range, errors) = Parse("2026-09-04", "2026-09-10", tz);

        Assert.That(range, Is.Null);
        Assert.That(errors, Is.EqualTo(new Dictionary<string, string> { ["tz"] = "invalid" }));
    }

    [Test]
    public void To_before_from_is_beforeFrom()
    {
        var (range, errors) = Parse("2026-09-10", "2026-09-09", "Europe/Paris");

        Assert.That(range, Is.Null);
        Assert.That(errors, Is.EqualTo(new Dictionary<string, string> { ["to"] = "beforeFrom" }));
    }
}
