namespace Nala.Core.Trends;

/// <summary>
/// A data day of Feed trends (spec 12). Counts and bottle ml go to the day each feed starts; breastfeeding seconds per side
/// are split across local days, a running side counting up to now; the gaps (start to start, up to 8 h) count on the later
/// feed's day.
/// </summary>
public sealed record FeedTrendDay(
    DateOnly Date, FeedKindCounts Count, BottleMl BottleMl, BreastSeconds BreastSeconds, long GapSecondsSum, int GapCount);

public sealed record FeedKindCounts(int Breastfeed, int Bottle, int Solids);

public sealed record BottleMl(int BreastMilk, int Formula);

public sealed record BreastSeconds(long Left, long Right);
