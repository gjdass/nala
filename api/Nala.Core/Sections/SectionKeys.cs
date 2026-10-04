namespace Nala.Core.Sections;

/// <summary>The home sections, in the default order a new user gets.</summary>
public static class SectionKeys
{
    public const int MaxLength = 32;

    public static readonly IReadOnlyList<string> Default = ["feed", "sleep", "diaper", "pump", "growth", "health"];
}
