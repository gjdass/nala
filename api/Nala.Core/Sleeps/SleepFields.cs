using Nala.Core.Entries;

namespace Nala.Core.Sleeps;

/// <summary>A sleep's fields as sent by a client.</summary>
public sealed record SleepInput(DateTimeOffset? StartTime, DateTimeOffset? EndTime, string? Notes);

/// <summary>Validation of a sleep's fields, for adding and editing (spec 06).</summary>
public static class SleepFields
{
    /// <summary>
    /// Field name → error code (<c>required</c>, <c>inFuture</c>, <c>beforeStart</c>: the end isn't after the start,
    /// <c>tooLong</c>); empty when valid.
    /// </summary>
    public static Dictionary<string, string> Validate(SleepInput input, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string>();
        if (input.StartTime is not { } start)
        {
            errors["startTime"] = "required";
        }
        else if (EntryFields.IsInFuture(start, now))
        {
            errors["startTime"] = "inFuture";
        }

        if (input.EndTime is not { } end)
        {
            errors["endTime"] = "required";
        }
        else if (EntryFields.IsInFuture(end, now))
        {
            errors["endTime"] = "inFuture";
        }
        else if (input.StartTime is { } startTime && end <= startTime)
        {
            errors["endTime"] = "beforeStart";
        }

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }
}
