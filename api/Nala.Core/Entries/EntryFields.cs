namespace Nala.Core.Entries;

/// <summary>Field rules shared by every kind of entry (spec 04): notes, times not in the future, text normalisation.</summary>
public static class EntryFields
{
    public const int NotesMaxLength = 1000;

    /// <summary>How far ahead of the server clock a time may be, for devices whose clock runs a little fast.</summary>
    public static readonly TimeSpan FutureTolerance = TimeSpan.FromMinutes(1);

    /// <summary>Trimmed; blank text is none.</summary>
    public static string? NormalizeText(string? input) =>
        string.IsNullOrWhiteSpace(input) ? null : input.Trim();

    /// <summary>Whether <paramref name="time"/> is further ahead of <paramref name="now"/> than the tolerance.</summary>
    public static bool IsInFuture(DateTimeOffset time, DateTimeOffset now) => time > now + FutureTolerance;

    /// <summary>
    /// The start and end time rules of an entry with both (Sleep, Pump), added to <paramref name="errors"/>:
    /// <c>startTime</c> <c>required</c> / <c>inFuture</c>; <c>endTime</c> <c>required</c> / <c>inFuture</c> /
    /// <c>beforeStart</c> (not after the start), or <c>notAllowed</c> on a <paramref name="live"/> entry, which has none.
    /// </summary>
    public static void ValidateStartEnd(
        DateTimeOffset? startTime, DateTimeOffset? endTime, DateTimeOffset now, bool live, Dictionary<string, string> errors)
    {
        if (startTime is not { } start)
        {
            errors["startTime"] = "required";
        }
        else if (IsInFuture(start, now))
        {
            errors["startTime"] = "inFuture";
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
        else if (IsInFuture(end, now))
        {
            errors["endTime"] = "inFuture";
        }
        else if (startTime is { } from && end <= from)
        {
            errors["endTime"] = "beforeStart";
        }
    }
}
