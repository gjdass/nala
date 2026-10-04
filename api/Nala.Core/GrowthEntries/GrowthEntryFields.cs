using Nala.Core.Babies;
using Nala.Core.Entries;

namespace Nala.Core.GrowthEntries;

/// <summary>
/// A growth entry's fields as sent by a client (the kind is sent apart: it is only given when adding). The weight is a decimal
/// so a fractional one can be refused.
/// </summary>
public sealed record GrowthEntryInput(
    DateOnly? Date, decimal? WeightG, decimal? LengthCm, decimal? HeadCircumferenceCm, string? Notes, string? Milestone = null, string? Title = null);

/// <summary>Validation of a growth entry's fields, for adding and editing (spec 10).</summary>
public static class GrowthEntryFields
{
    public const int MinWeightG = 300;

    public const int MaxWeightG = 30000;

    public const decimal MinLengthCm = 20m;

    public const decimal MaxLengthCm = 130m;

    public const decimal MinHeadCircumferenceCm = 15m;

    public const decimal MaxHeadCircumferenceCm = 60m;

    public const int TitleMaxLength = 100;

    private static readonly Dictionary<string, GrowthKind> Kinds = new()
    {
        ["measurement"] = GrowthKind.Measurement,
        ["milestone"] = GrowthKind.Milestone,
    };

    private static readonly Dictionary<string, GrowthMilestone> Milestones = new()
    {
        ["firstSmile"] = GrowthMilestone.FirstSmile,
        ["firstLaugh"] = GrowthMilestone.FirstLaugh,
        ["holdsHead"] = GrowthMilestone.HoldsHead,
        ["rollsOver"] = GrowthMilestone.RollsOver,
        ["sitsUp"] = GrowthMilestone.SitsUp,
        ["crawls"] = GrowthMilestone.Crawls,
        ["firstTooth"] = GrowthMilestone.FirstTooth,
        ["standsUp"] = GrowthMilestone.StandsUp,
        ["firstSteps"] = GrowthMilestone.FirstSteps,
        ["firstWord"] = GrowthMilestone.FirstWord,
        ["custom"] = GrowthMilestone.Custom,
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
    /// <paramref name="birthDate"/>; a measurement needs at least one value (<c>measurements</c>: <c>required</c>); a
    /// milestone needs a known <c>milestone</c>, and a custom one a <c>title</c>. The other kind's fields are not checked.
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
        else if (input.Milestone is null)
        {
            errors["milestone"] = "required";
        }
        else if (!Milestones.TryGetValue(input.Milestone, out var milestone))
        {
            errors["milestone"] = "invalid";
        }
        else if (milestone == GrowthMilestone.Custom)
        {
            var title = EntryFields.NormalizeText(input.Title);
            if (title is null)
            {
                errors["title"] = "required";
            }
            else if (title.Length > TitleMaxLength)
            {
                errors["title"] = "tooLong";
            }
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

    /// <summary>Call only on a validated milestone.</summary>
    public static GrowthMilestone ParseMilestone(string milestone) => Milestones[milestone];

    public static string FormatMilestone(GrowthMilestone milestone) => Milestones.Single(m => m.Value == milestone).Key;
}
