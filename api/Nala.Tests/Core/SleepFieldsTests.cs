using Nala.Core.Sleeps;

namespace Nala.Tests.Core;

public class SleepFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private static SleepInput Sleep(DateTimeOffset? startTime = null, DateTimeOffset? endTime = null, string? notes = null) =>
        new(startTime ?? Now.AddHours(-2), endTime ?? Now.AddHours(-1), notes);

    private static Dictionary<string, string> Validate(SleepInput input) => SleepFields.Validate(input);

    [Test]
    public void A_complete_sleep_is_valid() =>
        Assert.That(Validate(Sleep(notes: "in the stroller")), Is.Empty);

    [Test]
    public void Start_time_is_required() =>
        Assert.That(Validate(Sleep() with { StartTime = null }), Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "required" }));

    [Test]
    public void End_time_is_required() =>
        Assert.That(Validate(Sleep() with { EndTime = null }), Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "required" }));

    [Test]
    public void Times_may_be_in_the_future() =>
        Assert.That(Validate(Sleep(startTime: Now.AddDays(2), endTime: Now.AddDays(2).AddHours(1))), Is.Empty);

    [TestCase(-1)]
    [TestCase(0)]
    public void The_end_must_be_after_the_start(int minutesAfterStart) =>
        Assert.That(
            Validate(Sleep(startTime: Now.AddHours(-1), endTime: Now.AddHours(-1).AddMinutes(minutesAfterStart))),
            Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "beforeStart" }));

    [Test]
    public void Notes_are_at_most_1000_characters_once_trimmed()
    {
        Assert.That(Validate(Sleep(notes: $"  {new string('a', 1000)}  ")), Is.Empty);
        Assert.That(Validate(Sleep(notes: new string('a', 1001))), Is.EqualTo(new Dictionary<string, string> { ["notes"] = "tooLong" }));
    }

    [Test]
    public void A_live_sleep_has_no_end_time() =>
        Assert.That(SleepFields.Validate(Sleep() with { EndTime = null }, live: true), Is.Empty);

    [Test]
    public void A_live_sleep_refuses_an_end_time() =>
        Assert.That(
            SleepFields.Validate(Sleep(), live: true),
            Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "notAllowed" }));

    [Test]
    public void A_live_sleep_still_checks_its_start_time_and_notes() =>
        Assert.That(
            SleepFields.Validate(new SleepInput(null, null, new string('a', 1001)), live: true),
            Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "required", ["notes"] = "tooLong" }));
}
