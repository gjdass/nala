namespace Nala.Core.Auth;

public static class DisplayName
{
    public const int MaxLength = 50;

    /// <summary>Trims; valid when 1 to <see cref="MaxLength"/> characters remain.</summary>
    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = (input ?? string.Empty).Trim();
        return normalized.Length is > 0 and <= MaxLength;
    }
}
