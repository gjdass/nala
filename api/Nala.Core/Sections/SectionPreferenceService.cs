using Nala.Core.Users;

namespace Nala.Core.Sections;

public abstract record SaveSectionsResult
{
    public sealed record Saved(IReadOnlyList<SectionSetting> Sections) : SaveSectionsResult;

    /// <summary>Field <c>sections</c> → <c>invalid</c> (not every known key exactly once) or <c>noneVisible</c>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : SaveSectionsResult;
}

/// <summary>Each user's order and visibility of the home sections; never touches the sections' entries.</summary>
public class SectionPreferenceService(ISectionPreferenceRepository preferences)
{
    /// <summary>
    /// The user's list: the default order until they save one. Keys added since are appended visible;
    /// keys no longer known are dropped.
    /// </summary>
    public async Task<IReadOnlyList<SectionSetting>> GetAsync(User user, CancellationToken cancellationToken = default)
    {
        var stored = (await preferences.ListAsync(user.Id, cancellationToken))
            .Where(p => SectionKeys.Default.Contains(p.Key))
            .Select(p => new SectionSetting(p.Key, p.Visible))
            .ToList();
        var added = SectionKeys.Default
            .Where(key => stored.All(s => s.Key != key))
            .Select(key => new SectionSetting(key, true));
        return [.. stored, .. added];
    }

    /// <summary>Replaces the whole list, which must hold every known key exactly once, with at least one visible.</summary>
    public async Task<SaveSectionsResult> SaveAsync(
        User user, IReadOnlyList<SectionSetting>? sections, CancellationToken cancellationToken = default)
    {
        if (sections is null
            || sections.Count != SectionKeys.Default.Count
            || !sections.Select(s => s.Key).ToHashSet().SetEquals(SectionKeys.Default))
        {
            return Invalid("invalid");
        }

        if (!sections.Any(s => s.Visible))
        {
            return Invalid("noneVisible");
        }

        var rows = sections
            .Select((s, i) => new SectionPreference { UserId = user.Id, Key = s.Key, Position = i, Visible = s.Visible })
            .ToList();
        await preferences.ReplaceAsync(user.Id, rows, cancellationToken);
        return new SaveSectionsResult.Saved(sections);
    }

    private static SaveSectionsResult.Invalid Invalid(string code) =>
        new(new Dictionary<string, string> { ["sections"] = code });
}
