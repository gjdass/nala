using Nala.Core.Entries;

namespace Nala.Core.Diapers;

/// <summary>A diaper's fields as sent by a client; missing toggles are off.</summary>
public sealed record DiaperInput(DateTimeOffset? Time, bool Wet, bool Dirty, bool Rash, string? Notes);

/// <summary>Validation of a diaper's fields, for adding and editing (spec 07).</summary>
public static class DiaperFields
{
    /// <summary>Field name → error code (<c>required</c>, <c>inFuture</c>, <c>tooLong</c>); empty when valid.</summary>
    public static Dictionary<string, string> Validate(DiaperInput input, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string>();
        if (input.Time is not { } time)
        {
            errors["time"] = "required";
        }
        else if (EntryFields.IsInFuture(time, now))
        {
            errors["time"] = "inFuture";
        }

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }
}
