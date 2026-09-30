namespace Nala.Core.Feeds;

/// <summary>A feed's fields as sent by a client; the amount is a decimal so a fractional one can be refused.</summary>
public sealed record FeedInput(
    string? Kind,
    DateTimeOffset? StartTime,
    string? Notes,
    string? MilkType,
    decimal? AmountMl);

/// <summary>Validation of a feed's fields, for adding and editing (spec 05).</summary>
public static class FeedFields
{
    public const int NotesMaxLength = 1000;

    public const int AmountMinMl = 1;

    public const int AmountMaxMl = 500;

    /// <summary>How far ahead of the server clock a time may be, for devices whose clock runs a little fast.</summary>
    public static readonly TimeSpan FutureTolerance = TimeSpan.FromMinutes(1);

    private static readonly Dictionary<string, FeedKind> Kinds = new()
    {
        ["bottle"] = FeedKind.Bottle,
    };

    private static readonly Dictionary<string, MilkType> MilkTypes = new()
    {
        ["breastMilk"] = Feeds.MilkType.BreastMilk,
        ["formula"] = Feeds.MilkType.Formula,
    };

    /// <summary>
    /// Field name → error code (<c>required</c>, <c>invalid</c>, <c>inFuture</c>, <c>outOfRange</c>, <c>tooLong</c>); empty when valid.
    /// </summary>
    public static Dictionary<string, string> Validate(FeedInput input, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrEmpty(input.Kind))
        {
            errors["kind"] = "required";
        }
        else if (!Kinds.ContainsKey(input.Kind))
        {
            errors["kind"] = "invalid";
        }

        if (input.StartTime is not { } startTime)
        {
            errors["startTime"] = "required";
        }
        else if (startTime > now + FutureTolerance)
        {
            errors["startTime"] = "inFuture";
        }

        if (NormalizeNotes(input.Notes)?.Length > NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        if (input.Kind == "bottle")
        {
            ValidateBottle(input, errors);
        }

        return errors;
    }

    /// <summary>Trimmed; blank notes are none.</summary>
    public static string? NormalizeNotes(string? input) =>
        string.IsNullOrWhiteSpace(input) ? null : input.Trim();

    /// <summary>Call only on validated input.</summary>
    public static FeedKind ParseKind(string input) => Kinds[input];

    public static string Format(FeedKind kind) => Kinds.Single(k => k.Value == kind).Key;

    /// <summary>Call only on validated input.</summary>
    public static MilkType ParseMilkType(string input) => MilkTypes[input];

    public static string Format(MilkType milkType) => MilkTypes.Single(m => m.Value == milkType).Key;

    private static void ValidateBottle(FeedInput input, Dictionary<string, string> errors)
    {
        if (string.IsNullOrEmpty(input.MilkType))
        {
            errors["milkType"] = "required";
        }
        else if (!MilkTypes.ContainsKey(input.MilkType))
        {
            errors["milkType"] = "invalid";
        }

        if (input.AmountMl is not { } amount)
        {
            errors["amountMl"] = "required";
        }
        else if (decimal.Truncate(amount) != amount)
        {
            errors["amountMl"] = "invalid";
        }
        else if (amount is < AmountMinMl or > AmountMaxMl)
        {
            errors["amountMl"] = "outOfRange";
        }
    }
}
