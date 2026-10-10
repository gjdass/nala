namespace Nala.Core.Families;

public static class FamilyName
{
    public const int MaxLength = 50;

    /// <summary>Trims; null when 1 to <see cref="MaxLength"/> characters remain, else <c>required</c> or <c>tooLong</c>.</summary>
    public static string? Validate(string? input, out string normalized)
    {
        normalized = (input ?? string.Empty).Trim();
        return normalized.Length == 0 ? "required"
            : normalized.Length > MaxLength ? "tooLong"
            : null;
    }
}
