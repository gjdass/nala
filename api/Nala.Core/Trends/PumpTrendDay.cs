namespace Nala.Core.Trends;

/// <summary>
/// A data day of Pump trends (spec 12), on the local day each session starts: ml per side (a side not recorded counts 0) and
/// the sessions, live ones included.
/// </summary>
public sealed record PumpTrendDay(DateOnly Date, int LeftMl, int RightMl, int Sessions);
