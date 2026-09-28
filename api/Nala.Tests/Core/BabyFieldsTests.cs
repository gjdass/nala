using Nala.Core.Babies;

namespace Nala.Tests.Core;

public class BabyFieldsTests
{
    // 20:00 UTC on 27 Sep: already 28 Sep in UTC+14 (10:00), still 27 Sep in UTC.
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private static readonly BabyInput Valid = new("Lea", new DateOnly(2026, 9, 1), null, null, null, null);

    private static Dictionary<string, string> Validate(BabyInput input) => BabyFields.Validate(input, Now);

    [Test]
    public void A_name_and_birth_date_are_enough() => Assert.That(Validate(Valid), Is.Empty);

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public void Name_is_required(string? name) =>
        Assert.That(Validate(Valid with { Name = name }), Does.ContainKey("name").WithValue("required"));

    [Test]
    public void Name_is_fifty_characters_at_most_after_trimming()
    {
        Assert.That(Validate(Valid with { Name = "  " + new string('a', 50) + "  " }), Is.Empty);
        Assert.That(Validate(Valid with { Name = new string('a', 51) }), Does.ContainKey("name").WithValue("tooLong"));
    }

    [Test]
    public void Birth_date_is_required() =>
        Assert.That(Validate(Valid with { BirthDate = null }), Does.ContainKey("birthDate").WithValue("required"));

    [Test]
    public void Birth_date_can_be_today_anywhere_on_earth()
    {
        Assert.That(Validate(Valid with { BirthDate = new DateOnly(2026, 9, 27) }), Is.Empty);
        Assert.That(Validate(Valid with { BirthDate = new DateOnly(2026, 9, 28) }), Is.Empty, "today in UTC+14");
    }

    [Test]
    public void Birth_date_after_the_latest_today_on_earth_is_refused() =>
        Assert.That(
            Validate(Valid with { BirthDate = new DateOnly(2026, 9, 29) }),
            Does.ContainKey("birthDate").WithValue("inFuture"));

    [TestCase(null, Sex.Unspecified)]
    [TestCase("unspecified", Sex.Unspecified)]
    [TestCase("girl", Sex.Girl)]
    [TestCase("boy", Sex.Boy)]
    public void Sex_values(string? input, Sex expected)
    {
        Assert.That(Validate(Valid with { Sex = input }), Is.Empty);
        Assert.That(BabyFields.ParseSex(input), Is.EqualTo(expected));
    }

    [TestCase("Girl")]
    [TestCase("other")]
    public void Unknown_sex_is_invalid(string input) =>
        Assert.That(Validate(Valid with { Sex = input }), Does.ContainKey("sex").WithValue("invalid"));

    [TestCase(300)]
    [TestCase(3500)]
    [TestCase(7000)]
    public void Birth_weight_within_bounds(decimal grams) =>
        Assert.That(Validate(Valid with { BirthWeightG = grams }), Is.Empty);

    [TestCase(299)]
    [TestCase(7001)]
    [TestCase(0)]
    [TestCase(-5)]
    public void Birth_weight_out_of_bounds(decimal grams) =>
        Assert.That(Validate(Valid with { BirthWeightG = grams }), Does.ContainKey("birthWeightG").WithValue("outOfRange"));

    [Test]
    public void Birth_weight_is_whole_grams() =>
        Assert.That(Validate(Valid with { BirthWeightG = 3500.5m }), Does.ContainKey("birthWeightG").WithValue("invalid"));

    [TestCase(20)]
    [TestCase(49.5)]
    [TestCase(70)]
    public void Birth_length_within_bounds(decimal cm) =>
        Assert.That(Validate(Valid with { BirthLengthCm = cm }), Is.Empty);

    [TestCase(19.9)]
    [TestCase(70.1)]
    public void Birth_length_out_of_bounds(decimal cm) =>
        Assert.That(Validate(Valid with { BirthLengthCm = cm }), Does.ContainKey("birthLengthCm").WithValue("outOfRange"));

    [Test]
    public void Birth_length_has_one_decimal_at_most() =>
        Assert.That(Validate(Valid with { BirthLengthCm = 49.55m }), Does.ContainKey("birthLengthCm").WithValue("invalid"));

    [TestCase(15)]
    [TestCase(34.5)]
    [TestCase(50)]
    public void Head_circumference_within_bounds(decimal cm) =>
        Assert.That(Validate(Valid with { BirthHeadCircumferenceCm = cm }), Is.Empty);

    [TestCase(14.9)]
    [TestCase(50.1)]
    public void Head_circumference_out_of_bounds(decimal cm) =>
        Assert.That(
            Validate(Valid with { BirthHeadCircumferenceCm = cm }),
            Does.ContainKey("birthHeadCircumferenceCm").WithValue("outOfRange"));

    [Test]
    public void Head_circumference_has_one_decimal_at_most() =>
        Assert.That(
            Validate(Valid with { BirthHeadCircumferenceCm = 34.55m }),
            Does.ContainKey("birthHeadCircumferenceCm").WithValue("invalid"));

    [Test]
    public void Every_invalid_field_is_reported()
    {
        var errors = Validate(new BabyInput(null, null, "x", 10, 10, 10));

        Assert.That(errors.Keys, Is.EquivalentTo(new[]
        {
            "name", "birthDate", "sex", "birthWeightG", "birthLengthCm", "birthHeadCircumferenceCm",
        }));
    }
}
