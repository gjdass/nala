using System.Text.RegularExpressions;

namespace Nala.Core.Auth;

/// <summary>Emails are trusted as typed (no verification), compared case-insensitively and stored normalized.</summary>
public static partial class EmailAddress
{
    public const int MaxLength = 254;

    /// <summary>Trims and lower-cases; valid when it has one <c>@</c>, text on both sides, a dot in the domain and no spaces.</summary>
    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = (input ?? string.Empty).Trim().ToLowerInvariant();
        return normalized.Length <= MaxLength && Shape().IsMatch(normalized);
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex Shape();
}
