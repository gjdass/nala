namespace Nala.Core.Entries;

/// <summary>Paging of a baby's entries, newest first, shared by every section (spec 04 History paging).</summary>
public static class EntryPaging
{
    public const int DefaultPageSize = 20;

    public const int MaxPageSize = 50;

    /// <summary><paramref name="limit"/>, <see cref="DefaultPageSize"/> by default, kept within 1–<see cref="MaxPageSize"/>.</summary>
    public static int Size(int? limit) => Math.Clamp(limit ?? DefaultPageSize, 1, MaxPageSize);

    /// <summary>
    /// The page out of <paramref name="entries"/>, read with one more than <paramref name="size"/> to tell whether
    /// another page follows, and the cursor of that page (null after the last one).
    /// </summary>
    public static (IReadOnlyList<T> Page, string? Next) Split<T>(IReadOnlyList<T> entries, int size, Func<T, EntryCursor> cursorOf)
    {
        if (entries.Count <= size)
        {
            return (entries, null);
        }

        var page = entries.Take(size).ToList();
        return (page, cursorOf(page[^1]).Encode());
    }
}
