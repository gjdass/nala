using Nala.Core.GrowthEntries;

namespace Nala.Tests.Core;

public class GrowthEntryFieldsTests
{
    /// <summary>11:00 UTC: already Oct 4 in UTC+14, still Oct 3 in UTC.</summary>
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 11, 0, 0, TimeSpan.Zero);

    private static readonly DateOnly BirthDate = new(2026, 9, 1);

    private static GrowthEntryInput Measurement(
        DateOnly? date = null, decimal? weightG = 4250m, decimal? lengthCm = 55.5m, decimal? headCircumferenceCm = 38m, string? notes = null) =>
        new(date ?? new DateOnly(2026, 10, 1), weightG, lengthCm, headCircumferenceCm, notes);

    private static Dictionary<string, string> Validate(GrowthEntryInput input) =>
        GrowthEntryFields.Validate(GrowthKind.Measurement, input, Now, BirthDate);

    private static Dictionary<string, string> Error(string field, string code) => new() { [field] = code };

    [Test]
    public void A_complete_measurement_is_valid() =>
        Assert.That(Validate(Measurement(notes: "doctor")), Is.Empty);

    [Test]
    public void A_single_value_is_enough()
    {
        Assert.Multiple(() =>
        {
            Assert.That(Validate(Measurement(lengthCm: null, headCircumferenceCm: null)), Is.Empty);
            Assert.That(Validate(Measurement(weightG: null, headCircumferenceCm: null)), Is.Empty);
            Assert.That(Validate(Measurement(weightG: null, lengthCm: null)), Is.Empty);
        });
    }

    [Test]
    public void A_measurement_needs_at_least_one_value() =>
        Assert.That(
            Validate(Measurement(weightG: null, lengthCm: null, headCircumferenceCm: null)),
            Is.EqualTo(Error("measurements", "required")));

    [Test]
    public void Date_is_required() =>
        Assert.That(Validate(Measurement() with { Date = null }), Is.EqualTo(Error("date", "required")));

    [Test]
    public void Date_may_be_today_anywhere_on_earth() =>
        Assert.That(Validate(Measurement(date: new DateOnly(2026, 10, 4))), Is.Empty);

    [Test]
    public void Date_after_today_anywhere_on_earth_is_in_the_future() =>
        Assert.That(Validate(Measurement(date: new DateOnly(2026, 10, 5))), Is.EqualTo(Error("date", "inFuture")));

    [Test]
    public void Date_may_be_the_birth_date() =>
        Assert.That(Validate(Measurement(date: BirthDate)), Is.Empty);

    [Test]
    public void Date_before_the_birth_date_is_refused() =>
        Assert.That(Validate(Measurement(date: BirthDate.AddDays(-1))), Is.EqualTo(Error("date", "beforeBirth")));

    [TestCase(300)]
    [TestCase(30000)]
    public void Weight_bounds_are_valid(int grams) =>
        Assert.That(Validate(Measurement(weightG: grams)), Is.Empty);

    [TestCase(299)]
    [TestCase(30001)]
    public void Weight_out_of_range_is_refused(int grams) =>
        Assert.That(Validate(Measurement(weightG: grams)), Is.EqualTo(Error("weightG", "outOfRange")));

    [Test]
    public void Weight_must_be_whole_grams() =>
        Assert.That(Validate(Measurement(weightG: 4250.5m)), Is.EqualTo(Error("weightG", "invalid")));

    [TestCase(19.9)]
    [TestCase(130.1)]
    public void Length_out_of_range_is_refused(decimal cm) =>
        Assert.That(Validate(Measurement(lengthCm: cm)), Is.EqualTo(Error("lengthCm", "outOfRange")));

    [TestCase(20)]
    [TestCase(130)]
    public void Length_bounds_are_valid(decimal cm) =>
        Assert.That(Validate(Measurement(lengthCm: cm)), Is.Empty);

    [Test]
    public void Length_has_at_most_one_decimal() =>
        Assert.That(Validate(Measurement(lengthCm: 55.55m)), Is.EqualTo(Error("lengthCm", "invalid")));

    [TestCase(14.9)]
    [TestCase(60.1)]
    public void Head_circumference_out_of_range_is_refused(decimal cm) =>
        Assert.That(Validate(Measurement(headCircumferenceCm: cm)), Is.EqualTo(Error("headCircumferenceCm", "outOfRange")));

    [TestCase(15)]
    [TestCase(60)]
    public void Head_circumference_bounds_are_valid(decimal cm) =>
        Assert.That(Validate(Measurement(headCircumferenceCm: cm)), Is.Empty);

    [Test]
    public void Head_circumference_has_at_most_one_decimal() =>
        Assert.That(Validate(Measurement(headCircumferenceCm: 38.05m)), Is.EqualTo(Error("headCircumferenceCm", "invalid")));

    [Test]
    public void Notes_are_at_most_1000_characters()
    {
        Assert.That(Validate(Measurement(notes: new string('a', 1000))), Is.Empty);
        Assert.That(Validate(Measurement(notes: new string('a', 1001))), Is.EqualTo(Error("notes", "tooLong")));
    }

    [Test]
    public void The_measurement_kind_is_valid() =>
        Assert.That(GrowthEntryFields.ValidateKind("measurement"), Is.Empty);

    [Test]
    public void Kind_is_required() =>
        Assert.That(GrowthEntryFields.ValidateKind(null), Is.EqualTo(Error("kind", "required")));

    [Test]
    public void The_milestone_kind_is_valid() =>
        Assert.That(GrowthEntryFields.ValidateKind("milestone"), Is.Empty);

    [TestCase("weight")]
    [TestCase("Measurement")]
    [TestCase("Milestone")]
    public void An_unknown_kind_is_invalid(string kind) =>
        Assert.That(GrowthEntryFields.ValidateKind(kind), Is.EqualTo(Error("kind", "invalid")));

    [Test]
    public void Kinds_are_parsed_and_formatted()
    {
        Assert.That(GrowthEntryFields.ParseKind("measurement"), Is.EqualTo(GrowthKind.Measurement));
        Assert.That(GrowthEntryFields.Format(GrowthKind.Measurement), Is.EqualTo("measurement"));
        Assert.That(GrowthEntryFields.ParseKind("milestone"), Is.EqualTo(GrowthKind.Milestone));
        Assert.That(GrowthEntryFields.Format(GrowthKind.Milestone), Is.EqualTo("milestone"));
    }

    private static GrowthEntryInput Milestone(string? milestone = "firstTooth", string? title = null, DateOnly? date = null) =>
        new(date ?? new DateOnly(2026, 10, 1), null, null, null, null, milestone, title);

    private static Dictionary<string, string> ValidateMilestone(GrowthEntryInput input) =>
        GrowthEntryFields.Validate(GrowthKind.Milestone, input, Now, BirthDate);

    [TestCase("firstSmile")]
    [TestCase("firstLaugh")]
    [TestCase("holdsHead")]
    [TestCase("rollsOver")]
    [TestCase("sitsUp")]
    [TestCase("crawls")]
    [TestCase("firstTooth")]
    [TestCase("standsUp")]
    [TestCase("firstSteps")]
    [TestCase("firstWord")]
    public void Every_preset_milestone_is_valid_without_a_title(string milestone)
    {
        Assert.That(ValidateMilestone(Milestone(milestone)), Is.Empty);
        Assert.That(GrowthEntryFields.FormatMilestone(GrowthEntryFields.ParseMilestone(milestone)), Is.EqualTo(milestone));
    }

    [Test]
    public void A_milestone_is_required() =>
        Assert.That(ValidateMilestone(Milestone(null)), Is.EqualTo(Error("milestone", "required")));

    [TestCase("firstTeeth")]
    [TestCase("FirstTooth")]
    public void An_unknown_milestone_is_invalid(string milestone) =>
        Assert.That(ValidateMilestone(Milestone(milestone)), Is.EqualTo(Error("milestone", "invalid")));

    [TestCase(null)]
    [TestCase("   ")]
    public void A_custom_milestone_needs_a_title(string? title) =>
        Assert.That(ValidateMilestone(Milestone("custom", title)), Is.EqualTo(Error("title", "required")));

    [Test]
    public void A_custom_title_is_at_most_100_characters_once_trimmed()
    {
        Assert.That(ValidateMilestone(Milestone("custom", " " + new string('a', 100) + " ")), Is.Empty);
        Assert.That(ValidateMilestone(Milestone("custom", new string('a', 101))), Is.EqualTo(Error("title", "tooLong")));
    }

    [Test]
    public void A_preset_ignores_the_title() =>
        Assert.That(ValidateMilestone(Milestone("firstSmile", new string('a', 500))), Is.Empty);

    [Test]
    public void A_milestone_ignores_the_measurement_values() =>
        Assert.That(ValidateMilestone(Milestone() with { WeightG = 1m, LengthCm = 500.55m }), Is.Empty);

    [Test]
    public void A_measurement_ignores_the_milestone_fields() =>
        Assert.That(Validate(Measurement() with { Milestone = "nope", Title = new string('a', 500) }), Is.Empty);

    [Test]
    public void A_milestone_has_the_same_date_rules()
    {
        Assert.Multiple(() =>
        {
            Assert.That(ValidateMilestone(Milestone() with { Date = null }), Is.EqualTo(Error("date", "required")));
            Assert.That(ValidateMilestone(Milestone(date: new DateOnly(2026, 10, 5))), Is.EqualTo(Error("date", "inFuture")));
            Assert.That(ValidateMilestone(Milestone(date: BirthDate.AddDays(-1))), Is.EqualTo(Error("date", "beforeBirth")));
        });
    }

    [Test]
    public void A_milestone_notes_are_at_most_1000_characters() =>
        Assert.That(ValidateMilestone(Milestone() with { Notes = new string('a', 1001) }), Is.EqualTo(Error("notes", "tooLong")));
}
