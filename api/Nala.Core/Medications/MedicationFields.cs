using Nala.Core.Entries;

namespace Nala.Core.Medications;

/// <summary>A dose's fields as sent by a client. The unit is ignored without an amount.</summary>
public sealed record MedicationInput(DateTimeOffset? Time, string? Name, decimal? Amount, string? Unit, string? Notes);

/// <summary>Validation of a dose's fields, for adding and editing (spec 09).</summary>
public static class MedicationFields
{
    public const int NameMaxLength = 100;

    public const decimal MinAmount = 0.01m;

    public const decimal MaxAmount = 1000m;

    private static readonly Dictionary<string, MedicationUnit> Units = new()
    {
        ["ml"] = MedicationUnit.Ml,
        ["mg"] = MedicationUnit.Mg,
        ["drops"] = MedicationUnit.Drops,
        ["dose"] = MedicationUnit.Dose,
    };

    /// <summary>
    /// Field name → error code (<c>required</c>, <c>inFuture</c>, <c>tooLong</c>, <c>outOfRange</c>, <c>invalid</c>); empty
    /// when valid. The unit is only checked with an amount.
    /// </summary>
    public static Dictionary<string, string> Validate(MedicationInput input, DateTimeOffset now)
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

        var name = EntryFields.NormalizeText(input.Name);
        if (name is null)
        {
            errors["name"] = "required";
        }
        else if (name.Length > NameMaxLength)
        {
            errors["name"] = "tooLong";
        }

        if (input.Amount is { } amount)
        {
            if (amount < MinAmount || amount > MaxAmount)
            {
                errors["amount"] = "outOfRange";
            }
            else if (decimal.Round(amount, 2) != amount)
            {
                errors["amount"] = "invalid";
            }

            if (input.Unit is null)
            {
                errors["unit"] = "required";
            }
            else if (!Units.ContainsKey(input.Unit))
            {
                errors["unit"] = "invalid";
            }
        }

        if (EntryFields.NormalizeText(input.Notes)?.Length > EntryFields.NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        return errors;
    }

    /// <summary>Call only on validated input.</summary>
    public static MedicationUnit? ParseUnit(string? input) => input is null ? null : Units[input];

    public static string Format(MedicationUnit unit) => Units.Single(u => u.Value == unit).Key;
}
