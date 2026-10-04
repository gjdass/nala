namespace Nala.Core.GrowthEntries;

/// <summary>
/// The latest value of one measure (grams for the weight, cm otherwise) and its date; <paramref name="Birth"/> when it comes
/// from the baby's birth fields rather than an entry.
/// </summary>
public sealed record LatestMeasure(decimal Value, DateOnly Date, bool Birth);

/// <summary>The latest value of each measure of a baby; null when it has none.</summary>
public sealed record GrowthLatest(LatestMeasure? Weight, LatestMeasure? Length, LatestMeasure? HeadCircumference);
