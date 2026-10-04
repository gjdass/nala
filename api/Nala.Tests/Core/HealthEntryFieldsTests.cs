using Nala.Core.HealthEntries;

namespace Nala.Tests.Core;

public class HealthEntryFieldsTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private static HealthEntryInput HealthEntry(DateTimeOffset? time = null, string? name = "Paracetamol", decimal? amount = 2.5m, string? unit = "ml", decimal? temperature = null, string? notes = null) =>
        new(time ?? Now.AddMinutes(-10), name, amount, unit, temperature, notes);

    private static Dictionary<string, string> Validate(HealthEntryInput input) => HealthEntryFields.Validate(input, Now);

    private static Dictionary<string, string> Error(string field, string code) => new() { [field] = code };

    [Test]
    public void A_complete_dose_is_valid() =>
        Assert.That(Validate(HealthEntry(notes: "with food")), Is.Empty);

    [Test]
    public void A_dose_without_amount_or_unit_is_valid() =>
        Assert.That(Validate(HealthEntry(amount: null, unit: null)), Is.Empty);

    [Test]
    public void Time_is_required() =>
        Assert.That(Validate(HealthEntry() with { Time = null }), Is.EqualTo(Error("time", "required")));

    [Test]
    public void Time_may_be_up_to_one_minute_ahead() =>
        Assert.That(Validate(HealthEntry(time: Now.AddSeconds(60))), Is.Empty);

    [Test]
    public void Time_more_than_one_minute_ahead_is_in_the_future() =>
        Assert.That(Validate(HealthEntry(time: Now.AddSeconds(61))), Is.EqualTo(Error("time", "inFuture")));

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public void A_name_or_a_temperature_is_required(string? name) =>
        Assert.That(Validate(HealthEntry(name: name, amount: null, unit: null)), Is.EqualTo(Error("name", "required")));

    [Test]
    public void A_temperature_alone_is_valid() =>
        Assert.That(Validate(HealthEntry(name: null, amount: null, unit: null, temperature: 38.5m)), Is.Empty);

    [Test]
    public void A_name_and_a_temperature_together_are_valid() =>
        Assert.That(Validate(HealthEntry(temperature: 38.5m)), Is.Empty);

    [TestCase(30)]
    [TestCase(45)]
    [TestCase(38.5)]
    public void Temperature_from_30_to_45_with_1_decimal_is_valid(double temperature) =>
        Assert.That(Validate(HealthEntry(temperature: (decimal)temperature)), Is.Empty);

    [TestCase(29.9)]
    [TestCase(45.1)]
    public void Temperature_outside_30_to_45_is_out_of_range(double temperature) =>
        Assert.That(Validate(HealthEntry(temperature: (decimal)temperature)), Is.EqualTo(Error("temperature", "outOfRange")));

    [Test]
    public void Temperature_with_more_than_1_decimal_is_invalid() =>
        Assert.That(Validate(HealthEntry(temperature: 38.55m)), Is.EqualTo(Error("temperature", "invalid")));

    [Test]
    public void An_amount_needs_a_name()
    {
        Assert.That(Validate(HealthEntry(name: " ", temperature: 38.5m)), Is.EqualTo(Error("amount", "nameRequired")));
        Assert.That(
            Validate(HealthEntry(name: null)),
            Is.EqualTo(new Dictionary<string, string> { ["name"] = "required", ["amount"] = "nameRequired" }));
    }

    [Test]
    public void Name_is_at_most_100_characters_once_trimmed()
    {
        Assert.That(Validate(HealthEntry(name: $"  {new string('a', 100)}  ")), Is.Empty);
        Assert.That(Validate(HealthEntry(name: new string('a', 101))), Is.EqualTo(Error("name", "tooLong")));
    }

    [TestCase(0.01)]
    [TestCase(1000)]
    [TestCase(12.25)]
    public void Amount_from_001_to_1000_with_2_decimals_is_valid(double amount) =>
        Assert.That(Validate(HealthEntry(amount: (decimal)amount)), Is.Empty);

    [TestCase(0)]
    [TestCase(-1)]
    [TestCase(0.001)]
    [TestCase(1000.01)]
    public void Amount_outside_001_to_1000_is_out_of_range(double amount) =>
        Assert.That(Validate(HealthEntry(amount: (decimal)amount)), Is.EqualTo(Error("amount", "outOfRange")));

    [Test]
    public void Amount_with_more_than_2_decimals_is_invalid() =>
        Assert.That(Validate(HealthEntry(amount: 2.505m)), Is.EqualTo(Error("amount", "invalid")));

    [Test]
    public void Every_unit_is_valid()
    {
        foreach (var unit in new[] { "ml", "mg", "drops", "dose" })
        {
            Assert.That(Validate(HealthEntry(unit: unit)), Is.Empty, unit);
        }
    }

    [Test]
    public void An_amount_needs_a_unit() =>
        Assert.That(Validate(HealthEntry(unit: null)), Is.EqualTo(Error("unit", "required")));

    [Test]
    public void An_unknown_unit_is_invalid() =>
        Assert.That(Validate(HealthEntry(unit: "spoon")), Is.EqualTo(Error("unit", "invalid")));

    [Test]
    public void The_unit_is_not_checked_without_an_amount() =>
        Assert.That(Validate(HealthEntry(amount: null, unit: "spoon")), Is.Empty);

    [Test]
    public void Notes_are_at_most_1000_characters_once_trimmed()
    {
        Assert.That(Validate(HealthEntry(notes: $"  {new string('a', 1000)}  ")), Is.Empty);
        Assert.That(Validate(HealthEntry(notes: new string('a', 1001))), Is.EqualTo(Error("notes", "tooLong")));
    }
}
