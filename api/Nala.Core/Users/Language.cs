namespace Nala.Core.Users;

public static class Language
{
    public const string Default = "en";

    public static readonly IReadOnlyList<string> Supported = ["en", "fr"];

    /// <summary>The given language when supported, else <see cref="Default"/>.</summary>
    public static string OrDefault(string? language) =>
        language is not null && Supported.Contains(language) ? language : Default;
}
