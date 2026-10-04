using Nala.Core.Entries;

namespace Nala.Core.Pumps;

/// <summary>
/// A pumping session's fields as sent by a client. The volumes are decimals so a fractional one gets a validation error
/// instead of being refused as malformed JSON.
/// </summary>
public sealed record PumpInput(DateTimeOffset? StartTime, DateTimeOffset? EndTime, decimal? LeftMl, decimal? RightMl, string? Notes);

/// <summary>Validation of a pumping session's fields, for adding and editing (spec 08).</summary>
public static class PumpFields
{
    public const int VolumeMaxMl = 500;

    /// <summary>
    /// Field name → error code: the start / end rules of <see cref="EntryFields.ValidateStartEnd"/>, <c>leftMl</c> /
    /// <c>rightMl</c> <c>invalid</c> (not a whole number) or <c>outOfRange</c> (not 0–500; null is not recorded), and
    /// notes <c>tooLong</c>; empty when valid.
    /// </summary>
    public static Dictionary<string, string> Validate(PumpInput input, DateTimeOffset now, bool live = false)
    {
        var errors = new Dictionary<string, string>();
        EntryFields.ValidateStartEnd(input.StartTime, input.EndTime, now, live, errors);
        ValidateVolume("leftMl", input.LeftMl, errors);
        ValidateVolume("rightMl", input.RightMl, errors);

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }

    private static void ValidateVolume(string field, decimal? volume, Dictionary<string, string> errors)
    {
        if (volume is not { } ml)
        {
            return;
        }

        if (decimal.Truncate(ml) != ml)
        {
            errors[field] = "invalid";
        }
        else if (ml is < 0 or > VolumeMaxMl)
        {
            errors[field] = "outOfRange";
        }
    }
}
