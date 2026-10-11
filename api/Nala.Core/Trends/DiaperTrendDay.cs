namespace Nala.Core.Trends;

/// <summary>
/// A data day of Diaper trends (spec 12), on the local day of each diaper's time: wet and dirty diapers (a wet and dirty one
/// counts in both) and every diaper, dry ones included.
/// </summary>
public sealed record DiaperTrendDay(DateOnly Date, int Wet, int Dirty, int Count);
