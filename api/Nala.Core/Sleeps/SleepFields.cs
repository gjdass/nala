using Nala.Core.Entries;

namespace Nala.Core.Sleeps;

/// <summary>A sleep's fields as sent by a client.</summary>
public sealed record SleepInput(DateTimeOffset? StartTime, DateTimeOffset? EndTime, string? Notes);

/// <summary>Validation of a sleep's fields, for adding and editing (spec 06).</summary>
public static class SleepFields
{
    /// <summary>
    /// Field name → error code (<c>required</c>, <c>beforeStart</c>: the end isn't after the start,
    /// <c>tooLong</c>, and <c>notAllowed</c>: an end time on a <paramref name="live"/> sleep, which has none); empty when valid.
    /// </summary>
    public static Dictionary<string, string> Validate(SleepInput input, bool live = false)
    {
        var errors = new Dictionary<string, string>();
        EntryFields.ValidateStartEnd(input.StartTime, input.EndTime, live, errors);

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }
}
