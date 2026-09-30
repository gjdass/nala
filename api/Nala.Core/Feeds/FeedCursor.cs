using System.Buffers.Text;
using System.Globalization;
using System.Text;

namespace Nala.Core.Feeds;

/// <summary>Where a page of a baby's feeds ends: the start time and id of its last feed. Opaque to clients.</summary>
public sealed record FeedCursor(DateTimeOffset StartTime, Guid Id)
{
    public string Encode() =>
        Base64Url.EncodeToString(Encoding.UTF8.GetBytes($"{StartTime.UtcTicks}.{Id:N}"));

    /// <summary>Null when <paramref name="value"/> isn't a cursor this API issued.</summary>
    public static FeedCursor? TryDecode(string? value)
    {
        if (string.IsNullOrEmpty(value) || !Base64Url.IsValid(value))
        {
            return null;
        }

        var parts = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(value)).Split('.');
        return parts.Length == 2
            && long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
            && ticks <= DateTimeOffset.MaxValue.UtcTicks
            && Guid.TryParseExact(parts[1], "N", out var id)
                ? new FeedCursor(new DateTimeOffset(ticks, TimeSpan.Zero), id)
                : null;
    }
}
