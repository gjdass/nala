namespace Nala.Core.Feeds;

/// <summary>
/// A feed's fields as sent by a client; the fields of the other kinds are ignored. The amount is a decimal so a
/// fractional one can be refused.
/// </summary>
public sealed record FeedInput(
    string? Kind,
    DateTimeOffset? StartTime,
    string? Notes,
    string? MilkType,
    decimal? AmountMl,
    string? MealType = null,
    string? Food = null,
    string? Reaction = null,
    BreastfeedDurations? Durations = null);

/// <summary>A breastfeed's durations typed by hand, in whole seconds, and the side it ended on.</summary>
public sealed record BreastfeedDurations(int? LeftSeconds, int? RightSeconds, string? EndedOn);

/// <summary>Validation of a feed's fields, for adding and editing (spec 05).</summary>
public static class FeedFields
{
    public const int NotesMaxLength = 1000;

    public const int FoodMaxLength = 500;

    public const int AmountMinMl = 1;

    public const int AmountMaxMl = 500;

    /// <summary>The longest duration typed by hand for one side: 4 h.</summary>
    public const int DurationMaxSeconds = 4 * 60 * 60;

    /// <summary>How far ahead of the server clock a time may be, for devices whose clock runs a little fast.</summary>
    public static readonly TimeSpan FutureTolerance = TimeSpan.FromMinutes(1);

    private static readonly Dictionary<string, FeedKind> Kinds = new()
    {
        ["bottle"] = FeedKind.Bottle,
        ["solids"] = FeedKind.Solids,
        ["breastfeed"] = FeedKind.Breastfeed,
    };

    private static readonly Dictionary<string, BreastSide> Sides = new()
    {
        ["left"] = BreastSide.Left,
        ["right"] = BreastSide.Right,
    };

    private static readonly Dictionary<string, MilkType> MilkTypes = new()
    {
        ["breastMilk"] = Feeds.MilkType.BreastMilk,
        ["formula"] = Feeds.MilkType.Formula,
    };

    private static readonly Dictionary<string, MealType> MealTypes = new()
    {
        ["breakfast"] = Feeds.MealType.Breakfast,
        ["lunch"] = Feeds.MealType.Lunch,
        ["dinner"] = Feeds.MealType.Dinner,
        ["snack"] = Feeds.MealType.Snack,
    };

    private static readonly Dictionary<string, SolidsReaction> Reactions = new()
    {
        ["liked"] = SolidsReaction.Liked,
        ["neutral"] = SolidsReaction.Neutral,
        ["disliked"] = SolidsReaction.Disliked,
        ["allergicReaction"] = SolidsReaction.AllergicReaction,
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

        if (NormalizeText(input.Notes)?.Length > NotesMaxLength)
        {
            errors["notes"] = "tooLong";
        }

        if (input.Kind == "bottle")
        {
            ValidateBottle(input, errors);
        }
        else if (input.Kind == "solids")
        {
            ValidateSolids(input, errors);
        }
        else if (input.Kind == "breastfeed" && input.Durations is { } durations)
        {
            ValidateDurations(durations, input.StartTime, now, errors);
        }

        return errors;
    }

    /// <summary>Trimmed; blank text (notes, food) is none.</summary>
    public static string? NormalizeText(string? input) =>
        string.IsNullOrWhiteSpace(input) ? null : input.Trim();

    /// <summary>Call only on validated input.</summary>
    public static FeedKind ParseKind(string input) => Kinds[input];

    public static string Format(FeedKind kind) => Kinds.Single(k => k.Value == kind).Key;

    /// <summary>Call only on validated input.</summary>
    public static MilkType ParseMilkType(string input) => MilkTypes[input];

    public static string Format(MilkType milkType) => MilkTypes.Single(m => m.Value == milkType).Key;

    /// <summary>Validation of a breastfeed timer action: the side (when given) and when it happened.</summary>
    public static Dictionary<string, string> ValidateTimerAction(string? side, bool needsSide, DateTimeOffset? at, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string>();
        if (needsSide && string.IsNullOrEmpty(side))
        {
            errors["side"] = "required";
        }
        else if (needsSide && !Sides.ContainsKey(side!))
        {
            errors["side"] = "invalid";
        }

        if (at is not { } time)
        {
            errors["at"] = "required";
        }
        else if (time > now + FutureTolerance)
        {
            errors["at"] = "inFuture";
        }

        return errors;
    }

    /// <summary>Call only on validated input.</summary>
    public static BreastSide ParseSide(string input) => Sides[input];

    public static string Format(BreastSide side) => Sides.Single(s => s.Value == side).Key;

    /// <summary>Call only on validated input; null when none.</summary>
    public static MealType? ParseMealType(string? input) => input is null ? null : MealTypes[input];

    public static string Format(MealType mealType) => MealTypes.Single(m => m.Value == mealType).Key;

    /// <summary>Call only on validated input; null when none.</summary>
    public static SolidsReaction? ParseReaction(string? input) => input is null ? null : Reactions[input];

    public static string Format(SolidsReaction reaction) => Reactions.Single(r => r.Value == reaction).Key;

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

    /// <summary>
    /// Call only on validated durations: the ended-on side, which is the only side above 0 when the other one is at 0.
    /// </summary>
    public static BreastSide EndedOn(BreastfeedDurations durations) =>
        durations.LeftSeconds == 0 ? BreastSide.Right
        : durations.RightSeconds == 0 ? BreastSide.Left
        : ParseSide(durations.EndedOn!);

    private static void ValidateDurations(BreastfeedDurations durations, DateTimeOffset? startTime, DateTimeOffset now, Dictionary<string, string> errors)
    {
        if (durations.LeftSeconds is not (>= 0 and <= DurationMaxSeconds) || durations.RightSeconds is not (>= 0 and <= DurationMaxSeconds))
        {
            errors["durations"] = "outOfRange";
            return;
        }

        var total = durations.LeftSeconds.Value + durations.RightSeconds.Value;
        if (total == 0)
        {
            errors["durations"] = "zero";
        }
        else if (startTime?.AddSeconds(total) > now + FutureTolerance)
        {
            errors["durations"] = "inFuture";
        }

        if (durations.LeftSeconds > 0 && durations.RightSeconds > 0)
        {
            if (string.IsNullOrEmpty(durations.EndedOn))
            {
                errors["endedOn"] = "required";
            }
            else if (!Sides.ContainsKey(durations.EndedOn))
            {
                errors["endedOn"] = "invalid";
            }
        }
    }

    private static void ValidateSolids(FeedInput input, Dictionary<string, string> errors)
    {
        if (input.MealType is not null && !MealTypes.ContainsKey(input.MealType))
        {
            errors["mealType"] = "invalid";
        }

        var food = NormalizeText(input.Food);
        if (food is null)
        {
            errors["food"] = "required";
        }
        else if (food.Length > FoodMaxLength)
        {
            errors["food"] = "tooLong";
        }

        if (input.Reaction is not null && !Reactions.ContainsKey(input.Reaction))
        {
            errors["reaction"] = "invalid";
        }
    }
}
