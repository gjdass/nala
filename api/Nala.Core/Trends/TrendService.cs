using Nala.Core.Families;
using Nala.Core.Sleeps;
using Nala.Core.Users;

namespace Nala.Core.Trends;

public abstract record TrendResult<TDay>
{
    /// <summary>Only the data days of the range, in date order.</summary>
    public sealed record Days(IReadOnlyList<TDay> Items) : TrendResult<TDay>;

    /// <summary>Field name → error code, see <see cref="TrendRange.Parse"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : TrendResult<TDay>;

    public sealed record BabyNotFound : TrendResult<TDay>;
}

/// <summary>
/// A baby's trends (spec 12), aggregated per local day of the caller's time zone. Only data days are returned: a day without
/// an entry of the section has no data, it isn't a zero. A live entry counts up to now.
/// </summary>
public class TrendService(ISleepRepository sleeps, FamilyAccess access, TimeProvider time)
{
    /// <summary>Night is 19:00 to 07:00 local, fixed.</summary>
    public static readonly TimeOnly NightStart = new(19, 0);

    public static readonly TimeOnly NightEnd = new(7, 0);

    /// <summary>
    /// Seconds slept by day and by night, split across local days; the longest sleep (its whole duration) on the day it starts.
    /// </summary>
    public async Task<TrendResult<SleepTrendDay>> SleepsAsync(
        User user, Guid babyId, string? from, string? to, string? tz, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        if (TrendRange.Parse(from, to, tz, errors) is not { } range)
        {
            return new TrendResult<SleepTrendDay>.Invalid(errors);
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new TrendResult<SleepTrendDay>.BabyNotFound();
        }

        var now = time.GetUtcNow();
        var (rangeStart, rangeEnd) = (range.StartUtc, range.EndUtc);
        var days = new SortedDictionary<DateOnly, (TimeSpan Day, TimeSpan Night, TimeSpan? Longest)>();
        foreach (var sleep in await sleeps.ListOverlappingAsync(babyId, rangeStart, rangeEnd, cancellationToken))
        {
            var end = sleep.EndTime ?? now;
            foreach (var piece in LocalDays.Split(LocalDays.Max(sleep.StartTime, rangeStart), LocalDays.Min(end, rangeEnd), range.Zone))
            {
                var night = Night(piece, range.Zone);
                var day = days.GetValueOrDefault(piece.Date);
                days[piece.Date] = (day.Day + piece.Duration - night, day.Night + night, day.Longest);
            }

            var startDate = LocalDays.DateOf(sleep.StartTime, range.Zone);
            if (end > sleep.StartTime && range.Contains(startDate))
            {
                var day = days[startDate];
                var duration = end - sleep.StartTime;
                days[startDate] = day with { Longest = day.Longest is { } longest && longest > duration ? longest : duration };
            }
        }

        return new TrendResult<SleepTrendDay>.Days(days
            .Select(d => new SleepTrendDay(d.Key, Seconds(d.Value.Day), Seconds(d.Value.Night), d.Value.Longest is { } l ? Seconds(l) : null))
            .ToList());
    }

    /// <summary>The part of a day's piece between 00:00 and 07:00 or between 19:00 and midnight.</summary>
    private static TimeSpan Night(DayPiece piece, TimeZoneInfo zone) =>
        LocalDays.Overlap(piece.From, piece.To, LocalDays.StartUtc(piece.Date, zone), LocalDays.ToUtc(piece.Date, NightEnd, zone))
        + LocalDays.Overlap(piece.From, piece.To, LocalDays.ToUtc(piece.Date, NightStart, zone), LocalDays.StartUtc(piece.Date.AddDays(1), zone));

    private static long Seconds(TimeSpan duration) => (long)Math.Floor(duration.TotalSeconds);
}
