namespace Nala.Core.Entries;

/// <summary>Field rules shared by every kind of entry (spec 04): notes, times not in the future, text normalisation.</summary>
public static class EntryFields
{
    public const int NotesMaxLength = 1000;

    /// <summary>How far ahead of the server clock a time may be, for devices whose clock runs a little fast.</summary>
    public static readonly TimeSpan FutureTolerance = TimeSpan.FromMinutes(1);

    /// <summary>Trimmed; blank text is none.</summary>
    public static string? NormalizeText(string? input) =>
        string.IsNullOrWhiteSpace(input) ? null : input.Trim();

    /// <summary>Whether <paramref name="time"/> is further ahead of <paramref name="now"/> than the tolerance.</summary>
    public static bool IsInFuture(DateTimeOffset time, DateTimeOffset now) => time > now + FutureTolerance;
}
