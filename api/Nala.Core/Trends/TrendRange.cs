using System.Globalization;

namespace Nala.Core.Trends;

/// <summary>The local days <see cref="From"/> to <see cref="To"/>, both included, in <see cref="Zone"/>.</summary>
public sealed record TrendRange(DateOnly From, DateOnly To, TimeZoneInfo Zone)
{
    /// <summary>The start of <see cref="From"/>.</summary>
    public DateTimeOffset StartUtc => LocalDays.StartUtc(From, Zone);

    /// <summary>The start of the day after <see cref="To"/>, excluded.</summary>
    public DateTimeOffset EndUtc => LocalDays.StartUtc(To.AddDays(1), Zone);

    public bool Contains(DateOnly date) => date >= From && date <= To;

    /// <summary>
    /// The range from a trends query, or null with the errors added: <c>from</c> / <c>to</c> <c>required</c> or <c>invalid</c>
    /// (not a <c>yyyy-MM-dd</c> date), <c>to</c> <c>beforeFrom</c>, <c>tz</c> <c>required</c> or <c>invalid</c> (not a known IANA zone).
    /// </summary>
    public static TrendRange? Parse(string? from, string? to, string? tz, Dictionary<string, string> errors)
    {
        var dates = ParseDates(from, to, errors);

        TimeZoneInfo? zone = null;
        if (string.IsNullOrWhiteSpace(tz))
        {
            errors["tz"] = "required";
        }
        else if (!TimeZoneInfo.TryFindSystemTimeZoneById(tz, out zone) || !zone.HasIanaId)
        {
            errors["tz"] = "invalid";
        }

        return errors.Count == 0 ? new TrendRange(dates!.Value.From, dates.Value.To, zone!) : null;
    }

    /// <summary>
    /// The local dates of a query, or null with the errors added: <c>from</c> / <c>to</c> <c>required</c> or <c>invalid</c>
    /// (not a <c>yyyy-MM-dd</c> date), <c>to</c> <c>beforeFrom</c>.
    /// </summary>
    public static (DateOnly From, DateOnly To)? ParseDates(string? from, string? to, Dictionary<string, string> errors)
    {
        var fromDate = ParseDate("from", from, errors);
        var toDate = ParseDate("to", to, errors);
        if (fromDate is { } f && toDate is { } t)
        {
            if (t >= f)
            {
                return (f, t);
            }

            errors["to"] = "beforeFrom";
        }

        return null;
    }

    private static DateOnly? ParseDate(string field, string? value, Dictionary<string, string> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = "required";
            return null;
        }

        if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            errors[field] = "invalid";
            return null;
        }

        return date;
    }
}
