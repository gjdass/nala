using Nala.Core.Feeds;

namespace Nala.Tests.Core;

public class FeedFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private static FeedInput Bottle(
        DateTimeOffset? startTime = null, string? milkType = "formula", decimal? amountMl = 120, string? notes = null, string? kind = "bottle") =>
        new(kind, startTime ?? Now.AddMinutes(-5), notes, milkType, amountMl);

    private static Dictionary<string, string> Validate(FeedInput input) => FeedFields.Validate(input, Now);

    [Test]
    public void A_complete_bottle_is_valid()
    {
        Assert.That(Validate(Bottle()), Is.Empty);
        Assert.That(Validate(Bottle(milkType: "breastMilk")), Is.Empty);
    }

    [TestCase(null, "required")]
    [TestCase("", "required")]
    [TestCase("lunch", "invalid")]
    public void Kind_must_be_known(string? kind, string code) =>
        Assert.That(Validate(Bottle(kind: kind)), Is.EqualTo(new Dictionary<string, string> { ["kind"] = code }));

    [Test]
    public void Start_time_is_required() =>
        Assert.That(Validate(Bottle() with { StartTime = null }), Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "required" }));

    [Test]
    public void Start_time_may_be_up_to_one_minute_ahead() =>
        Assert.That(Validate(Bottle(startTime: Now.AddSeconds(60))), Is.Empty);

    [Test]
    public void Start_time_more_than_one_minute_ahead_is_refused() =>
        Assert.That(Validate(Bottle(startTime: Now.AddSeconds(61))), Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "inFuture" }));

    [TestCase(null, "required")]
    [TestCase("", "required")]
    [TestCase("milk", "invalid")]
    public void Bottle_milk_type_must_be_known(string? milkType, string code) =>
        Assert.That(Validate(Bottle(milkType: milkType)), Is.EqualTo(new Dictionary<string, string> { ["milkType"] = code }));

    [Test]
    public void Bottle_amount_is_required() =>
        Assert.That(Validate(Bottle() with { AmountMl = null }), Is.EqualTo(new Dictionary<string, string> { ["amountMl"] = "required" }));

    [TestCase(0, "outOfRange")]
    [TestCase(501, "outOfRange")]
    [TestCase(12.5, "invalid")]
    public void Bottle_amount_is_a_whole_number_from_1_to_500(decimal amount, string code) =>
        Assert.That(Validate(Bottle(amountMl: amount)), Is.EqualTo(new Dictionary<string, string> { ["amountMl"] = code }));

    [TestCase(1)]
    [TestCase(500)]
    public void Bottle_amount_bounds_are_accepted(decimal amount) =>
        Assert.That(Validate(Bottle(amountMl: amount)), Is.Empty);

    [Test]
    public void Notes_are_at_most_1000_characters()
    {
        Assert.That(Validate(Bottle(notes: new string('a', 1000))), Is.Empty);
        Assert.That(Validate(Bottle(notes: new string('a', 1001))), Is.EqualTo(new Dictionary<string, string> { ["notes"] = "tooLong" }));
    }

    [Test]
    public void Blank_notes_are_stored_as_none()
    {
        Assert.That(FeedFields.NormalizeNotes("  "), Is.Null);
        Assert.That(FeedFields.NormalizeNotes(" hungry "), Is.EqualTo("hungry"));
    }
}
