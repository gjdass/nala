using Nala.Core.Entries;

namespace Nala.Core.Sleeps;

/// <summary>A sleep's fields as sent by a client.</summary>
public sealed record SleepInput(DateTimeOffset? StartTime, DateTimeOffset? EndTime, string? Notes);

/// <summary>Validation of a sleep's fields, for adding and editing (spec 06).</summary>
public static class SleepFields
{
    /// <summary>
    /// Field name → error code (<c>required</c>, <c>inFuture</c>, <c>beforeStart</c>: the end isn't after the start,
    /// <c>tooLong</c>, and <c>notAllowed</c>: an end time on a <paramref name="live"/> sleep, which has none); empty when valid.
    /// </summary>
    public static Dictionary<string, string> Validate(SleepInput input, DateTimeOffset now, bool live = false)
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

        if (live)
        {
            if (input.EndTime is not null)
            {
                errors["endTime"] = "notAllowed";
            }
        }
        else if (input.EndTime is not { } end)
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

    /// <summary>Validation of a timer tap's time (<c>at</c>): <c>required</c>, <c>inFuture</c>; empty when valid.</summary>
    public static Dictionary<string, string> ValidateTimerAt(DateTimeOffset? at, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string>();
        if (at is not { } time)
        {
            errors["at"] = "required";
        }
        else if (EntryFields.IsInFuture(time, now))
        {
            errors["at"] = "inFuture";
        }

        return errors;
    }
}
