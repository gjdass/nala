using Nala.Core.Diapers;

namespace Nala.Tests.Core;

public class DiaperFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private static DiaperInput Diaper(DateTimeOffset? time = null, string? notes = null) =>
        new(time ?? Now.AddMinutes(-10), Wet: true, Dirty: false, Rash: false, notes);

    private static Dictionary<string, string> Validate(DiaperInput input) => DiaperFields.Validate(input, Now);

    [Test]
    public void A_complete_diaper_is_valid() =>
        Assert.That(Validate(Diaper(notes: "after the bath")), Is.Empty);

    [Test]
    public void A_dry_diaper_is_valid() =>
        Assert.That(Validate(Diaper() with { Wet = false, Dirty = false }), Is.Empty);

    [Test]
    public void Time_is_required() =>
        Assert.That(Validate(Diaper() with { Time = null }), Is.EqualTo(new Dictionary<string, string> { ["time"] = "required" }));

    [Test]
    public void Time_may_be_up_to_one_minute_ahead() =>
        Assert.That(Validate(Diaper(time: Now.AddSeconds(60))), Is.Empty);

    [Test]
    public void Time_more_than_one_minute_ahead_is_in_the_future() =>
        Assert.That(Validate(Diaper(time: Now.AddSeconds(61))), Is.EqualTo(new Dictionary<string, string> { ["time"] = "inFuture" }));

    [Test]
    public void Notes_are_at_most_1000_characters_once_trimmed()
    {
        Assert.That(Validate(Diaper(notes: $"  {new string('a', 1000)}  ")), Is.Empty);
        Assert.That(Validate(Diaper(notes: new string('a', 1001))), Is.EqualTo(new Dictionary<string, string> { ["notes"] = "tooLong" }));
    }
}
