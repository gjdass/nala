using Nala.Core.GrowthEntries;

namespace Nala.Core.Trends;

/// <summary>
/// A point of the growth curves (spec 12): a measurement's values, or the baby's birth measurements (<see cref="Birth"/>),
/// dated with the birth date.
/// </summary>
public sealed record GrowthTrendPoint(DateOnly Date, int? WeightG, decimal? LengthCm, decimal? HeadCircumferenceCm, bool Birth);

/// <summary>A milestone shown on the weight curve; <see cref="Title"/> only for a custom one.</summary>
public sealed record GrowthTrendMilestone(DateOnly Date, GrowthMilestone Milestone, string? Title);

/// <summary>The measurements and milestones dated in a range, in date order, the birth point first.</summary>
public sealed record GrowthTrends(IReadOnlyList<GrowthTrendPoint> Measurements, IReadOnlyList<GrowthTrendMilestone> Milestones);

public abstract record GrowthTrendResult
{
    public sealed record Found(GrowthTrends Trends) : GrowthTrendResult;

    /// <summary>Field name → error code, see <see cref="TrendRange.ParseDates"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : GrowthTrendResult;

    public sealed record BabyNotFound : GrowthTrendResult;
}
