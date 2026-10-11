namespace Nala.Core.Trends;

/// <summary>
/// A data day of Sleep trends (spec 12): seconds slept by day and by night (19:00–07:00 local), and the longest sleep
/// starting that day, null when none starts on it (the day only gets the end of an earlier sleep).
/// </summary>
public sealed record SleepTrendDay(DateOnly Date, long DaySeconds, long NightSeconds, long? LongestSeconds);
