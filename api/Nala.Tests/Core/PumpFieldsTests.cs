using Nala.Core.Pumps;

namespace Nala.Tests.Core;

public class PumpFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private static PumpInput Pump(
        DateTimeOffset? startTime = null, DateTimeOffset? endTime = null, decimal? leftMl = 90, decimal? rightMl = 80, string? notes = null) =>
        new(startTime ?? Now.AddMinutes(-30), endTime ?? Now.AddMinutes(-10), leftMl, rightMl, notes);

    private static Dictionary<string, string> Validate(PumpInput input) => PumpFields.Validate(input, Now);

    [Test]
    public void A_complete_session_is_valid() =>
        Assert.That(Validate(Pump(notes: "evening")), Is.Empty);

    [Test]
    public void Volumes_are_optional() =>
        Assert.That(Validate(Pump(leftMl: null, rightMl: null)), Is.Empty);

    [TestCase(0)]
    [TestCase(500)]
    public void Volumes_go_from_0_to_500(int ml) =>
        Assert.That(Validate(Pump(leftMl: ml, rightMl: ml)), Is.Empty);

    [TestCase(-1)]
    [TestCase(501)]
    public void Volumes_outside_0_to_500_are_out_of_range(int ml) =>
        Assert.That(
            Validate(Pump(leftMl: ml, rightMl: ml)),
            Is.EqualTo(new Dictionary<string, string> { ["leftMl"] = "outOfRange", ["rightMl"] = "outOfRange" }));

    [Test]
    public void Volumes_are_whole_numbers() =>
        Assert.That(
            Validate(Pump(leftMl: 90.5m, rightMl: 0.1m)),
            Is.EqualTo(new Dictionary<string, string> { ["leftMl"] = "invalid", ["rightMl"] = "invalid" }));

    [Test]
    public void Start_time_is_required() =>
        Assert.That(Validate(Pump() with { StartTime = null }), Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "required" }));

    [Test]
    public void End_time_is_required() =>
        Assert.That(Validate(Pump() with { EndTime = null }), Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "required" }));

    [Test]
    public void Times_more_than_one_minute_ahead_are_in_the_future() =>
        Assert.That(
            Validate(Pump(startTime: Now.AddMinutes(2), endTime: Now.AddMinutes(3))),
            Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "inFuture", ["endTime"] = "inFuture" }));

    [TestCase(-1)]
    [TestCase(0)]
    public void The_end_must_be_after_the_start(int minutesAfterStart) =>
        Assert.That(
            Validate(Pump(startTime: Now.AddHours(-1), endTime: Now.AddHours(-1).AddMinutes(minutesAfterStart))),
            Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "beforeStart" }));

    [Test]
    public void Notes_are_at_most_1000_characters_once_trimmed()
    {
        Assert.That(Validate(Pump(notes: $"  {new string('a', 1000)}  ")), Is.Empty);
        Assert.That(Validate(Pump(notes: new string('a', 1001))), Is.EqualTo(new Dictionary<string, string> { ["notes"] = "tooLong" }));
    }

    [Test]
    public void A_live_session_has_no_end_time() =>
        Assert.That(PumpFields.Validate(Pump() with { EndTime = null }, Now, live: true), Is.Empty);

    [Test]
    public void A_live_session_refuses_an_end_time() =>
        Assert.That(PumpFields.Validate(Pump(), Now, live: true), Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "notAllowed" }));
}
