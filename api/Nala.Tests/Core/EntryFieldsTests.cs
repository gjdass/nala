using Nala.Core.Entries;

namespace Nala.Tests.Core;

/// <summary>The start / end time and timer tap rules shared by every section with a start and an end (Sleep, Pump).</summary>
public class EntryFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private static Dictionary<string, string> Validate(DateTimeOffset? start, DateTimeOffset? end, bool live = false)
    {
        var errors = new Dictionary<string, string>();
        EntryFields.ValidateStartEnd(start, end, live, errors);
        return errors;
    }

    [Test]
    public void A_start_before_an_end_is_valid() =>
        Assert.That(Validate(Now.AddHours(-2), Now.AddHours(-1)), Is.Empty);

    [Test]
    public void Both_times_are_required_when_not_live() =>
        Assert.That(
            Validate(null, null),
            Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "required", ["endTime"] = "required" }));

    [Test]
    public void Times_may_be_in_the_future() =>
        Assert.That(Validate(Now.AddDays(2), Now.AddDays(2).AddHours(1)), Is.Empty);

    [TestCase(-1)]
    [TestCase(0)]
    public void The_end_must_be_after_the_start(int minutesAfterStart) =>
        Assert.That(
            Validate(Now.AddHours(-1), Now.AddHours(-1).AddMinutes(minutesAfterStart)),
            Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "beforeStart" }));

    [Test]
    public void A_live_entry_has_no_end_time()
    {
        Assert.That(Validate(Now.AddHours(-1), null, live: true), Is.Empty);
        Assert.That(
            Validate(Now.AddHours(-1), Now.AddMinutes(-1), live: true),
            Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "notAllowed" }));
    }

    [Test]
    public void A_timer_tap_needs_its_time() =>
        Assert.That(EntryFields.ValidateTimerAt(null), Is.EqualTo(new Dictionary<string, string> { ["at"] = "required" }));

    [Test]
    public void A_timer_tap_may_be_in_the_future() =>
        Assert.That(EntryFields.ValidateTimerAt(Now.AddHours(2)), Is.Empty);
}
