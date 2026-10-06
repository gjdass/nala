using Nala.Core.Entries;

namespace Nala.Core.Diapers;

/// <summary>
/// A diaper's fields as sent by a client; missing toggles are off. Colour and consistency are ignored unless the diaper is
/// dirty.
/// </summary>
public sealed record DiaperInput(
    DateTimeOffset? Time,
    bool Wet,
    bool Dirty,
    bool Rash,
    string? Notes,
    string? Color = null,
    string? Consistency = null);

/// <summary>Validation of a diaper's fields, for adding and editing (spec 07).</summary>
public static class DiaperFields
{
    private static readonly Dictionary<string, DiaperColor> Colors = new()
    {
        ["yellow"] = DiaperColor.Yellow,
        ["green"] = DiaperColor.Green,
        ["brown"] = DiaperColor.Brown,
        ["black"] = DiaperColor.Black,
        ["red"] = DiaperColor.Red,
        ["white"] = DiaperColor.White,
    };

    private static readonly Dictionary<string, DiaperConsistency> Consistencies = new()
    {
        ["liquid"] = DiaperConsistency.Liquid,
        ["runny"] = DiaperConsistency.Runny,
        ["soft"] = DiaperConsistency.Soft,
        ["firm"] = DiaperConsistency.Firm,
        ["hard"] = DiaperConsistency.Hard,
    };

    /// <summary>
    /// Field name → error code (<c>required</c>, <c>invalid</c>, <c>tooLong</c>); empty when valid. Colour
    /// and consistency are only checked for a dirty diaper.
    /// </summary>
    public static Dictionary<string, string> Validate(DiaperInput input)
    {
        var errors = new Dictionary<string, string>();
        if (input.Time is null)
        {
            errors["time"] = "required";
        }

        if (input.Dirty && input.Color is not null && !Colors.ContainsKey(input.Color))
        {
            errors["color"] = "invalid";
        }

        if (input.Dirty && input.Consistency is not null && !Consistencies.ContainsKey(input.Consistency))
        {
            errors["consistency"] = "invalid";
        }

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }

    /// <summary>Call only on validated input.</summary>
    public static DiaperColor? ParseColor(string? input) => input is null ? null : Colors[input];

    public static string Format(DiaperColor color) => Colors.Single(c => c.Value == color).Key;

    /// <summary>Call only on validated input.</summary>
    public static DiaperConsistency? ParseConsistency(string? input) => input is null ? null : Consistencies[input];

    public static string Format(DiaperConsistency consistency) => Consistencies.Single(c => c.Value == consistency).Key;
}
