using Nala.Core.Entries;
using Nala.Core.Feeds;

namespace Nala.Tests.Core;

public class FeedFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private static FeedInput Bottle(
        DateTimeOffset? startTime = null, string? milkType = "formula", decimal? amountMl = 120, string? notes = null, string? kind = "bottle") =>
        new(kind, startTime ?? Now.AddMinutes(-5), notes, milkType, amountMl);

    private static FeedInput Solids(string? food = "Carrot purée", string? mealType = "lunch", string? reaction = "liked") =>
        new("solids", Now.AddMinutes(-5), null, null, null, mealType, food, reaction);

    private static Dictionary<string, string> Validate(FeedInput input) => FeedFields.Validate(input);

    [Test]
    public void A_complete_bottle_is_valid()
    {
        Assert.That(Validate(Bottle()), Is.Empty);
        Assert.That(Validate(Bottle(milkType: "breastMilk")), Is.Empty);
    }

    [TestCase(null, "required")]
    [TestCase("", "required")]
    [TestCase("lunch", "invalid")]
    [TestCase("breakfast", "invalid")]
    public void Kind_must_be_known(string? kind, string code) =>
        Assert.That(Validate(Bottle(kind: kind)), Is.EqualTo(new Dictionary<string, string> { ["kind"] = code }));

    [Test]
    public void Start_time_is_required() =>
        Assert.That(Validate(Bottle() with { StartTime = null }), Is.EqualTo(new Dictionary<string, string> { ["startTime"] = "required" }));

    [Test]
    public void Start_time_may_be_in_the_future() =>
        Assert.That(Validate(Bottle(startTime: Now.AddDays(2))), Is.Empty);

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
        Assert.That(EntryFields.NormalizeText("  "), Is.Null);
        Assert.That(EntryFields.NormalizeText(" hungry "), Is.EqualTo("hungry"));
    }

    [Test]
    public void A_complete_solids_is_valid()
    {
        Assert.That(Validate(Solids()), Is.Empty);
        Assert.That(Validate(Solids(mealType: null, reaction: null)), Is.Empty);
        foreach (var mealType in new[] { "breakfast", "lunch", "dinner", "snack" })
        {
            Assert.That(Validate(Solids(mealType: mealType)), Is.Empty, mealType);
        }

        foreach (var reaction in new[] { "liked", "neutral", "disliked", "allergicReaction" })
        {
            Assert.That(Validate(Solids(reaction: reaction)), Is.Empty, reaction);
        }
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public void Solids_food_is_required(string? food) =>
        Assert.That(Validate(Solids(food: food)), Is.EqualTo(new Dictionary<string, string> { ["food"] = "required" }));

    [Test]
    public void Solids_food_is_at_most_500_characters_once_trimmed()
    {
        Assert.That(Validate(Solids(food: $"  {new string('a', 500)}  ")), Is.Empty);
        Assert.That(Validate(Solids(food: new string('a', 501))), Is.EqualTo(new Dictionary<string, string> { ["food"] = "tooLong" }));
    }

    [Test]
    public void Solids_meal_type_must_be_known() =>
        Assert.That(Validate(Solids(mealType: "brunch")), Is.EqualTo(new Dictionary<string, string> { ["mealType"] = "invalid" }));

    [Test]
    public void Solids_reaction_must_be_known() =>
        Assert.That(Validate(Solids(reaction: "meh")), Is.EqualTo(new Dictionary<string, string> { ["reaction"] = "invalid" }));

    [Test]
    public void Solids_ignore_the_bottle_fields() =>
        Assert.That(Validate(Solids() with { MilkType = "milk", AmountMl = 0 }), Is.Empty);

    [Test]
    public void A_bottle_ignores_the_solids_fields() =>
        Assert.That(Validate(Bottle() with { MealType = "brunch", Food = null, Reaction = "meh" }), Is.Empty);

    private static FeedInput Breastfeed(int? left = 300, int? right = 180, string? endedOn = "right", DateTimeOffset? startTime = null) =>
        new("breastfeed", startTime ?? Now.AddMinutes(-30), null, null, null, Durations: new BreastfeedDurations(left, right, endedOn));

    [Test]
    public void Typed_breastfeed_durations_are_valid()
    {
        Assert.That(Validate(Breastfeed()), Is.Empty);
        Assert.That(Validate(Breastfeed(left: 0, right: FeedFields.DurationMaxSeconds, startTime: Now.AddHours(-5))), Is.Empty);
    }

    [Test]
    public void A_breastfeed_without_typed_durations_is_valid_here() =>
        Assert.That(Validate(Breastfeed() with { Durations = null }), Is.Empty);

    [TestCase(-1, 60)]
    [TestCase(60, 14401)]
    [TestCase(null, 60)]
    public void Each_typed_side_is_from_0_to_4_hours(int? left, int? right) =>
        Assert.That(
            Validate(Breastfeed(left, right, startTime: Now.AddHours(-9))),
            Is.EqualTo(new Dictionary<string, string> { ["durations"] = "outOfRange" }));

    [Test]
    public void Both_typed_sides_at_zero_are_refused() =>
        Assert.That(Validate(Breastfeed(0, 0)), Is.EqualTo(new Dictionary<string, string> { ["durations"] = "zero" }));

    [Test]
    public void Typed_durations_may_end_in_the_future() =>
        Assert.That(Validate(Breastfeed(600, 661, startTime: Now.AddMinutes(-5))), Is.Empty);

    [TestCase(null, "required")]
    [TestCase("", "required")]
    [TestCase("middle", "invalid")]
    public void The_ended_on_side_is_needed_when_both_sides_are_typed(string? endedOn, string code) =>
        Assert.That(Validate(Breastfeed(endedOn: endedOn)), Is.EqualTo(new Dictionary<string, string> { ["endedOn"] = code }));

    [Test]
    public void The_ended_on_side_is_ignored_with_one_side_typed()
    {
        Assert.That(Validate(Breastfeed(left: 0, endedOn: null)), Is.Empty);
        Assert.That(Validate(Breastfeed(right: 0, endedOn: "right")), Is.Empty);
    }

    [Test]
    public void Other_kinds_ignore_typed_durations() =>
        Assert.That(Validate(Bottle() with { Durations = new BreastfeedDurations(-1, null, "middle") }), Is.Empty);
}
