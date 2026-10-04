using System.Buffers.Text;
using System.Globalization;
using System.Text;

namespace Nala.Core.GrowthEntries;

/// <summary>Where a page of a baby's growth entries ends: the date, creation time and id of its last entry. Opaque to clients.</summary>
public sealed record GrowthEntryCursor(DateOnly Date, DateTimeOffset CreatedAt, Guid Id)
{
    public string Encode() =>
        Base64Url.EncodeToString(Encoding.UTF8.GetBytes($"{Date.DayNumber}.{CreatedAt.UtcTicks}.{Id:N}"));

    /// <summary>Null when <paramref name="value"/> isn't a cursor this API issued.</summary>
    public static GrowthEntryCursor? TryDecode(string? value)
    {
        if (string.IsNullOrEmpty(value) || !Base64Url.IsValid(value))
        {
            return null;
        }

        var parts = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(value)).Split('.');
        return parts.Length == 3
            && int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var day)
            && day <= DateOnly.MaxValue.DayNumber
            && long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
            && ticks <= DateTimeOffset.MaxValue.UtcTicks
            && Guid.TryParseExact(parts[2], "N", out var id)
                ? new GrowthEntryCursor(DateOnly.FromDayNumber(day), new DateTimeOffset(ticks, TimeSpan.Zero), id)
                : null;
    }
}
