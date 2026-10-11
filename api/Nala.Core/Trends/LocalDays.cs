namespace Nala.Core.Trends;

/// <summary>One local day's part of a span (see <see cref="LocalDays.Split"/>).</summary>
public sealed record DayPiece(DateOnly Date, DateTimeOffset From, DateTimeOffset To)
{
    public TimeSpan Duration => To - From;
}

/// <summary>Local days in an IANA time zone (spec 12): the bounds of a day and spans split across days.</summary>
public static class LocalDays
{
    /// <summary>
    /// The UTC instant of a local date and time in <paramref name="zone"/>. A time skipped by a clock change moves to the
    /// first valid instant after it; a time that happens twice takes its first occurrence.
    /// </summary>
    public static DateTimeOffset ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(time);
        while (zone.IsInvalidTime(local))
        {
            local = local.AddMinutes(1);
        }

        var offset = zone.IsAmbiguousTime(local) ? zone.GetAmbiguousTimeOffsets(local).Max() : zone.GetUtcOffset(local);
        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    /// <summary>The UTC instant the local day starts.</summary>
    public static DateTimeOffset StartUtc(DateOnly date, TimeZoneInfo zone) => ToUtc(date, TimeOnly.MinValue, zone);

    public static DateOnly DateOf(DateTimeOffset instant, TimeZoneInfo zone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, zone).DateTime);

    /// <summary>The span [<paramref name="start"/>, <paramref name="end"/>) cut at each local midnight; nothing when it is empty.</summary>
    public static IEnumerable<DayPiece> Split(DateTimeOffset start, DateTimeOffset end, TimeZoneInfo zone)
    {
        var date = DateOf(start, zone);
        for (var from = start; from < end; date = date.AddDays(1))
        {
            var to = Min(StartUtc(date.AddDays(1), zone), end);
            yield return new DayPiece(date, from, to);
            from = to;
        }
    }

    /// <summary>How much of [<paramref name="from"/>, <paramref name="to"/>) falls inside [<paramref name="windowFrom"/>, <paramref name="windowTo"/>).</summary>
    public static TimeSpan Overlap(DateTimeOffset from, DateTimeOffset to, DateTimeOffset windowFrom, DateTimeOffset windowTo)
    {
        var overlap = Min(to, windowTo) - Max(from, windowFrom);
        return overlap > TimeSpan.Zero ? overlap : TimeSpan.Zero;
    }

    public static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;

    public static DateTimeOffset Max(DateTimeOffset a, DateTimeOffset b) => a > b ? a : b;
}
