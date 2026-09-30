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
    [TestCase("breakfast", "invalid")]
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
        Assert.That(FeedFields.NormalizeText("  "), Is.Null);
        Assert.That(FeedFields.NormalizeText(" hungry "), Is.EqualTo("hungry"));
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
}
