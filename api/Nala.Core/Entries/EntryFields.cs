namespace Nala.Core.Entries;

/// <summary>Field rules shared by every kind of entry (spec 04): notes, text normalisation, start / end times, timer taps. Times may be in the future.</summary>
public static class EntryFields
{
    public const int NotesMaxLength = 1000;

    /// <summary>Trimmed; blank text is none.</summary>
    public static string? NormalizeText(string? input) =>
        string.IsNullOrWhiteSpace(input) ? null : input.Trim();

    /// <summary>
    /// The start and end time rules of an entry with both (Sleep, Pump), added to <paramref name="errors"/>:
    /// <c>startTime</c> <c>required</c>; <c>endTime</c> <c>required</c> /
    /// <c>beforeStart</c> (not after the start), or <c>notAllowed</c> on a <paramref name="live"/> entry, which has none.
    /// </summary>
    public static void ValidateStartEnd(
        DateTimeOffset? startTime, DateTimeOffset? endTime, bool live, Dictionary<string, string> errors)
    {
        if (startTime is null)
        {
            errors["startTime"] = "required";
        }

        if (live)
        {
            if (endTime is not null)
            {
                errors["endTime"] = "notAllowed";
            }
        }
        else if (endTime is not { } end)
        {
            errors["endTime"] = "required";
        }
        else if (startTime is { } from && end <= from)
        {
            errors["endTime"] = "beforeStart";
        }
    }

    /// <summary>Validation of a timer tap's time (<c>at</c>): <c>required</c>; empty when valid.</summary>
    public static Dictionary<string, string> ValidateTimerAt(DateTimeOffset? at)
    {
        var errors = new Dictionary<string, string>();
        if (at is null)
        {
            errors["at"] = "required";
        }

        return errors;
    }
}
