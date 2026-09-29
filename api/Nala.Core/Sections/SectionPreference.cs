namespace Nala.Core.Sections;

/// <summary>Where a user shows a home section, and whether they show it at all.</summary>
public class SectionPreference
{
    public Guid UserId { get; init; }

    public required string Key { get; init; }

    public int Position { get; init; }

    public bool Visible { get; init; }
}

/// <summary>One section of a user's home, in list order.</summary>
public sealed record SectionSetting(string Key, bool Visible);
