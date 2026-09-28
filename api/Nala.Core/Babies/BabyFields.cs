namespace Nala.Core.Babies;

/// <summary>The baby fields as sent by a client; measurements are decimals so a fractional weight can be refused.</summary>
public sealed record BabyInput(
    string? Name,
    DateOnly? BirthDate,
    string? Sex,
    decimal? BirthWeightG,
    decimal? BirthLengthCm,
    decimal? BirthHeadCircumferenceCm);

/// <summary>Validation of a baby's fields, for adding and editing.</summary>
public static class BabyFields
{
    public const int NameMaxLength = 50;

    /// <summary>The latest calendar date anywhere on Earth (UTC+14), so no time zone's "today" is refused.</summary>
    private static readonly TimeSpan LatestOffset = TimeSpan.FromHours(14);

    private static readonly Dictionary<string, Sex> Sexes = new()
    {
        ["unspecified"] = Sex.Unspecified,
        ["girl"] = Sex.Girl,
        ["boy"] = Sex.Boy,
    };

    /// <summary>
    /// Field name → error code (<c>required</c>, <c>tooLong</c>, <c>inFuture</c>, <c>invalid</c>, <c>outOfRange</c>); empty when valid.
    /// </summary>
    public static Dictionary<string, string> Validate(BabyInput input, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string>();
        var name = NormalizeName(input.Name);
        if (name.Length == 0)
        {
            errors["name"] = "required";
        }
        else if (name.Length > NameMaxLength)
        {
            errors["name"] = "tooLong";
        }

        if (input.BirthDate is not { } birthDate)
        {
            errors["birthDate"] = "required";
        }
        else if (birthDate > DateOnly.FromDateTime(now.ToOffset(LatestOffset).DateTime))
        {
            errors["birthDate"] = "inFuture";
        }

        if (input.Sex is not null && !Sexes.ContainsKey(input.Sex))
        {
            errors["sex"] = "invalid";
        }

        CheckMeasurement(errors, "birthWeightG", input.BirthWeightG, decimals: 0, min: 300, max: 7000);
        CheckMeasurement(errors, "birthLengthCm", input.BirthLengthCm, decimals: 1, min: 20, max: 70);
        CheckMeasurement(errors, "birthHeadCircumferenceCm", input.BirthHeadCircumferenceCm, decimals: 1, min: 15, max: 50);
        return errors;
    }

    public static string NormalizeName(string? input) => (input ?? string.Empty).Trim();

    /// <summary>Null means unspecified; call only on validated input.</summary>
    public static Sex ParseSex(string? input) => input is null ? Sex.Unspecified : Sexes[input];

    public static string Format(Sex sex) => Sexes.Single(s => s.Value == sex).Key;

    private static void CheckMeasurement(
        Dictionary<string, string> errors, string field, decimal? value, int decimals, decimal min, decimal max)
    {
        if (value is not { } v)
        {
            return;
        }

        if (decimal.Round(v, decimals) != v)
        {
            errors[field] = "invalid";
        }
        else if (v < min || v > max)
        {
            errors[field] = "outOfRange";
        }
    }
}
