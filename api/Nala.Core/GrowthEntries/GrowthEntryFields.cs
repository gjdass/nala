using Nala.Core.Babies;
using Nala.Core.Entries;

namespace Nala.Core.GrowthEntries;

/// <summary>
/// A growth entry's fields as sent by a client (the kind is sent apart: it is only given when adding). The weight is a decimal
/// so a fractional one can be refused.
/// </summary>
public sealed record GrowthEntryInput(DateOnly? Date, decimal? WeightG, decimal? LengthCm, decimal? HeadCircumferenceCm, string? Notes);

/// <summary>Validation of a growth entry's fields, for adding and editing (spec 10).</summary>
public static class GrowthEntryFields
{
    public const int MinWeightG = 300;

    public const int MaxWeightG = 30000;

    public const decimal MinLengthCm = 20m;

    public const decimal MaxLengthCm = 130m;

    public const decimal MinHeadCircumferenceCm = 15m;

    public const decimal MaxHeadCircumferenceCm = 60m;

    private static readonly Dictionary<string, GrowthKind> Kinds = new()
    {
        ["measurement"] = GrowthKind.Measurement,
    };

    /// <summary>Field name → error code for the kind sent when adding (<c>required</c>, <c>invalid</c>); empty when valid.</summary>
    public static Dictionary<string, string> ValidateKind(string? kind)
    {
        var errors = new Dictionary<string, string>();
        if (kind is null)
        {
            errors["kind"] = "required";
        }
        else if (!Kinds.ContainsKey(kind))
        {
            errors["kind"] = "invalid";
        }

        return errors;
    }

    /// <summary>
    /// Field name → error code (<c>required</c>, <c>inFuture</c>, <c>beforeBirth</c>, <c>invalid</c>, <c>outOfRange</c>,
    /// <c>tooLong</c>); empty when valid. The date is not after today anywhere on Earth (as a birth date) nor before
    /// <paramref name="birthDate"/>; a measurement needs at least one value (<c>measurements</c>: <c>required</c>).
    /// </summary>
    public static Dictionary<string, string> Validate(GrowthKind kind, GrowthEntryInput input, DateTimeOffset now, DateOnly birthDate)
    {
        var errors = new Dictionary<string, string>();
        if (input.Date is not { } date)
        {
            errors["date"] = "required";
        }
        else if (date > BabyFields.LatestDate(now))
        {
            errors["date"] = "inFuture";
        }
        else if (date < birthDate)
        {
            errors["date"] = "beforeBirth";
        }

        if (kind == GrowthKind.Measurement)
        {
            if (input is { WeightG: null, LengthCm: null, HeadCircumferenceCm: null })
            {
                errors["measurements"] = "required";
            }

            BabyFields.CheckMeasurement(errors, "weightG", input.WeightG, decimals: 0, min: MinWeightG, max: MaxWeightG);
            BabyFields.CheckMeasurement(errors, "lengthCm", input.LengthCm, decimals: 1, min: MinLengthCm, max: MaxLengthCm);
            BabyFields.CheckMeasurement(
                errors, "headCircumferenceCm", input.HeadCircumferenceCm, decimals: 1, min: MinHeadCircumferenceCm, max: MaxHeadCircumferenceCm);
        }

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }

    /// <summary>Call only on a validated kind.</summary>
    public static GrowthKind ParseKind(string kind) => Kinds[kind];

    public static string Format(GrowthKind kind) => Kinds.Single(k => k.Value == kind).Key;
}
