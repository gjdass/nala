using Nala.Core.Diapers;
using Nala.Core.Families;
using Nala.Core.Feeds;
using Nala.Core.GrowthEntries;
using Nala.Core.Pumps;
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
public class TrendService(ISleepRepository sleeps, IDiaperRepository diapers, IPumpRepository pumps, IFeedRepository feeds, IGrowthEntryRepository growthEntries, FamilyAccess access, TimeProvider time)
{
    /// <summary>Night is 19:00 to 07:00 local, fixed.</summary>
    public static readonly TimeOnly NightStart = new(19, 0);

    public static readonly TimeOnly NightEnd = new(7, 0);

    /// <summary>A longer gap between two feeds is a night or a stretch nobody logged: it isn't a time between feeds.</summary>
    public static readonly TimeSpan MaxFeedGap = TimeSpan.FromHours(8);

    /// <summary>
    /// Seconds slept by day and by night, split across local days; the longest sleep (its whole duration) on the day it starts.
    /// </summary>
    public Task<TrendResult<SleepTrendDay>> SleepsAsync(
        User user, Guid babyId, string? from, string? to, string? tz, CancellationToken cancellationToken = default) =>
        AggregateAsync(user, babyId, from, to, tz, async range =>
        {
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

            return days
                .Select(d => new SleepTrendDay(d.Key, Seconds(d.Value.Day), Seconds(d.Value.Night), d.Value.Longest is { } l ? Seconds(l) : null))
                .ToList();
        }, cancellationToken);

    /// <summary>Wet, dirty and all diapers on the local day of their time; a wet and dirty one counts in both.</summary>
    public Task<TrendResult<DiaperTrendDay>> DiapersAsync(
        User user, Guid babyId, string? from, string? to, string? tz, CancellationToken cancellationToken = default) =>
        AggregateAsync(user, babyId, from, to, tz, async range =>
            (await diapers.ListInWindowAsync(babyId, range.StartUtc, range.EndUtc, cancellationToken))
                .GroupBy(d => LocalDays.DateOf(d.Time, range.Zone))
                .OrderBy(g => g.Key)
                .Select(g => new DiaperTrendDay(g.Key, g.Count(d => d.Wet), g.Count(d => d.Dirty), g.Count()))
                .ToList(), cancellationToken);

    /// <summary>Ml per side and sessions on the local day each session starts, live ones included; a side not recorded counts 0.</summary>
    public Task<TrendResult<PumpTrendDay>> PumpsAsync(
        User user, Guid babyId, string? from, string? to, string? tz, CancellationToken cancellationToken = default) =>
        AggregateAsync(user, babyId, from, to, tz, async range =>
            (await pumps.ListStartingInAsync(babyId, range.StartUtc, range.EndUtc, cancellationToken))
                .GroupBy(p => LocalDays.DateOf(p.StartTime, range.Zone))
                .OrderBy(g => g.Key)
                .Select(g => new PumpTrendDay(g.Key, g.Sum(p => p.LeftMl ?? 0), g.Sum(p => p.RightMl ?? 0), g.Count()))
                .ToList(), cancellationToken);

    /// <summary>
    /// Feeds by kind and bottle ml by milk type on the day each feed starts; breastfeeding seconds per side split across
    /// local days; the gaps from one feed's start to the next, up to <see cref="MaxFeedGap"/>, on the later feed's day.
    /// A day only reached by the end of an earlier breastfeed side is a data day without feeds.
    /// </summary>
    public Task<TrendResult<FeedTrendDay>> FeedsAsync(
        User user, Guid babyId, string? from, string? to, string? tz, CancellationToken cancellationToken = default) =>
        AggregateAsync(user, babyId, from, to, tz, async range =>
        {
            var now = time.GetUtcNow();
            var (rangeStart, rangeEnd) = (range.StartUtc, range.EndUtc);
            var days = new SortedDictionary<DateOnly, FeedDayTotals>();
            FeedDayTotals DayOf(DateOnly date) => days.TryGetValue(date, out var day) ? day : days[date] = new FeedDayTotals();

            var list = (await feeds.ListForTrendsAsync(babyId, rangeStart - MaxFeedGap, rangeStart, rangeEnd, cancellationToken))
                .OrderBy(f => f.StartTime).ThenBy(f => f.Id).ToList();
            for (var i = 0; i < list.Count; i++)
            {
                var feed = list[i];
                foreach (var segment in feed.Segments)
                {
                    var pieces = LocalDays.Split(
                        LocalDays.Max(segment.StartedAt, rangeStart), LocalDays.Min(segment.EndedAt ?? now, rangeEnd), range.Zone);
                    foreach (var piece in pieces)
                    {
                        DayOf(piece.Date).AddBreast(segment.Side, piece.Duration);
                    }
                }

                var startDate = LocalDays.DateOf(feed.StartTime, range.Zone);
                if (!range.Contains(startDate))
                {
                    continue;
                }

                var day = DayOf(startDate);
                day.Add(feed);
                var gap = i > 0 ? feed.StartTime - list[i - 1].StartTime : (TimeSpan?)null;
                if (gap <= MaxFeedGap)
                {
                    day.AddGap(gap.Value);
                }
            }

            return days.Select(d => d.Value.ToDay(d.Key)).ToList();
        }, cancellationToken);

    /// <summary>
    /// The measurements and milestones dated <c>from</c> to <c>to</c> (calendar dates, no time zone), in date order; the birth
    /// measurements first, as a point dated with the birth date, when it is in the range and the baby has any.
    /// </summary>
    public async Task<GrowthTrendResult> GrowthAsync(User user, Guid babyId, string? from, string? to, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        if (TrendRange.ParseDates(from, to, errors) is not var (fromDate, toDate))
        {
            return new GrowthTrendResult.Invalid(errors);
        }

        if (await access.ForBabyAsync(user, babyId, cancellationToken) is not { Baby: var baby })
        {
            return new GrowthTrendResult.BabyNotFound();
        }

        var entries = await growthEntries.ListDatedInAsync(babyId, fromDate, toDate, cancellationToken);
        var measurements = new List<GrowthTrendPoint>();
        var birthInRange = baby.BirthDate >= fromDate && baby.BirthDate <= toDate;
        if (birthInRange && (baby.BirthWeightG is not null || baby.BirthLengthCm is not null || baby.BirthHeadCircumferenceCm is not null))
        {
            measurements.Add(new GrowthTrendPoint(baby.BirthDate, baby.BirthWeightG, baby.BirthLengthCm, baby.BirthHeadCircumferenceCm, Birth: true));
        }

        measurements.AddRange(entries
            .Where(e => e.Kind == GrowthKind.Measurement)
            .Select(e => new GrowthTrendPoint(e.Date, e.WeightG, e.LengthCm, e.HeadCircumferenceCm, Birth: false)));
        var milestones = entries
            .Where(e => e.Kind == GrowthKind.Milestone)
            .Select(e => new GrowthTrendMilestone(e.Date, e.Milestone!.Value, e.Title))
            .ToList();
        return new GrowthTrendResult.Found(new GrowthTrends(measurements, milestones));
    }

    /// <summary>The query checked (its codes), then the baby (not found across families), then the section's data days.</summary>
    private async Task<TrendResult<TDay>> AggregateAsync<TDay>(
        User user, Guid babyId, string? from, string? to, string? tz,
        Func<TrendRange, Task<List<TDay>>> aggregate, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string>();
        if (TrendRange.Parse(from, to, tz, errors) is not { } range)
        {
            return new TrendResult<TDay>.Invalid(errors);
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new TrendResult<TDay>.BabyNotFound();
        }

        return new TrendResult<TDay>.Days(await aggregate(range));
    }

    /// <summary>The part of a day's piece between 00:00 and 07:00 or between 19:00 and midnight.</summary>
    private static TimeSpan Night(DayPiece piece, TimeZoneInfo zone) =>
        LocalDays.Overlap(piece.From, piece.To, LocalDays.StartUtc(piece.Date, zone), LocalDays.ToUtc(piece.Date, NightEnd, zone))
        + LocalDays.Overlap(piece.From, piece.To, LocalDays.ToUtc(piece.Date, NightStart, zone), LocalDays.StartUtc(piece.Date.AddDays(1), zone));

    private static long Seconds(TimeSpan duration) => (long)Math.Floor(duration.TotalSeconds);

    /// <summary>A Feed data day being summed up.</summary>
    private sealed class FeedDayTotals
    {
        private int _breastfeeds, _bottles, _solids, _breastMilkMl, _formulaMl, _gapCount;
        private TimeSpan _left, _right, _gaps;

        public void Add(Feed feed)
        {
            switch (feed.Kind)
            {
                case FeedKind.Breastfeed:
                    _breastfeeds++;
                    break;
                case FeedKind.Bottle when feed.MilkType == MilkType.BreastMilk:
                    _bottles++;
                    _breastMilkMl += feed.AmountMl ?? 0;
                    break;
                case FeedKind.Bottle:
                    _bottles++;
                    _formulaMl += feed.AmountMl ?? 0;
                    break;
                default:
                    _solids++;
                    break;
            }
        }

        public void AddBreast(BreastSide side, TimeSpan duration)
        {
            if (side == BreastSide.Left)
            {
                _left += duration;
            }
            else
            {
                _right += duration;
            }
        }

        public void AddGap(TimeSpan gap)
        {
            _gaps += gap;
            _gapCount++;
        }

        public FeedTrendDay ToDay(DateOnly date) => new(
            date,
            new FeedKindCounts(_breastfeeds, _bottles, _solids),
            new BottleMl(_breastMilkMl, _formulaMl),
            new BreastSeconds(Seconds(_left), Seconds(_right)),
            Seconds(_gaps),
            _gapCount);
    }
}
