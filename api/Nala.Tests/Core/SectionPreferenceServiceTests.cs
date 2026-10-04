using Nala.Core.Sections;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class SectionPreferenceServiceTests
{
    private FakeSectionPreferenceRepository _preferences = null!;
    private SectionPreferenceService _service = null!;
    private User _anna = null!;

    [SetUp]
    public void SetUp()
    {
        _preferences = new FakeSectionPreferenceRepository();
        _service = new SectionPreferenceService(_preferences);
        _anna = new User { Id = Guid.NewGuid(), Email = "anna@mail.com", DisplayName = "Anna", PreferredLanguage = "en" };
    }

    private void Store(Guid userId, params (string Key, bool Visible)[] rows) =>
        _preferences.Preferences.AddRange(rows.Select((r, i) =>
            new SectionPreference { UserId = userId, Key = r.Key, Position = i, Visible = r.Visible }));

    private static SectionSetting[] All(bool visible = true, params string[] order) =>
        (order.Length > 0 ? order : SectionKeys.Default).Select(k => new SectionSetting(k, visible)).ToArray();

    [Test]
    public async Task A_new_user_gets_the_default_order_all_visible()
    {
        var sections = await _service.GetAsync(_anna);

        Assert.That(sections, Is.EqualTo(new[]
        {
            new SectionSetting("feed", true),
            new SectionSetting("sleep", true),
            new SectionSetting("diaper", true),
            new SectionSetting("pump", true),
            new SectionSetting("growth", true),
            new SectionSetting("health", true),
        }));
    }

    [Test]
    public async Task Stored_preferences_are_returned_in_their_order()
    {
        Store(_anna.Id,
            ("growth", true), ("feed", false), ("sleep", true), ("diaper", true), ("health", false), ("pump", true));

        var sections = await _service.GetAsync(_anna);

        Assert.That(sections, Is.EqualTo(new[]
        {
            new SectionSetting("growth", true),
            new SectionSetting("feed", false),
            new SectionSetting("sleep", true),
            new SectionSetting("diaper", true),
            new SectionSetting("health", false),
            new SectionSetting("pump", true),
        }));
    }

    [Test]
    public async Task Keys_missing_from_stored_preferences_are_appended_visible()
    {
        Store(_anna.Id, ("sleep", false), ("feed", true), ("diaper", true), ("pump", true));

        var sections = await _service.GetAsync(_anna);

        Assert.That(sections.Select(s => s.Key), Is.EqualTo(new[] { "sleep", "feed", "diaper", "pump", "growth", "health" }));
        Assert.That(sections.Skip(4).Select(s => s.Visible), Is.All.True);
    }

    [Test]
    public async Task Unknown_stored_keys_are_dropped()
    {
        Store(_anna.Id,
            ("feed", true), ("bath", true), ("sleep", true), ("diaper", true), ("pump", true), ("growth", true), ("health", true));

        var sections = await _service.GetAsync(_anna);

        Assert.That(sections.Select(s => s.Key), Is.EqualTo(SectionKeys.Default));
    }

    [Test]
    public async Task Another_users_preferences_are_not_used()
    {
        Store(Guid.NewGuid(), ("health", false));

        var sections = await _service.GetAsync(_anna);

        Assert.That(sections, Is.EqualTo(All()));
    }

    [Test]
    public async Task Saving_replaces_the_users_preferences()
    {
        Store(_anna.Id, ("feed", true));
        var ben = Guid.NewGuid();
        Store(ben, ("feed", false));
        var order = new[] { "pump", "feed", "sleep", "diaper", "growth", "health" };
        var input = order.Select(k => new SectionSetting(k, k != "sleep")).ToArray();

        var result = await _service.SaveAsync(_anna, input);

        Assert.That(((SaveSectionsResult.Saved)result).Sections, Is.EqualTo(input));
        var stored = _preferences.Preferences.Where(p => p.UserId == _anna.Id).OrderBy(p => p.Position).ToList();
        Assert.That(stored.Select(p => p.Key), Is.EqualTo(order));
        Assert.That(stored.Select(p => p.Position), Is.EqualTo(new[] { 0, 1, 2, 3, 4, 5 }));
        Assert.That(stored.Single(p => p.Key == "sleep").Visible, Is.False);
        Assert.That(await _service.GetAsync(_anna), Is.EqualTo(input));
        Assert.That(_preferences.Preferences.Single(p => p.UserId == ben).Visible, Is.False, "Ben's row is untouched");
    }

    private static IEnumerable<TestCaseData> InvalidLists()
    {
        yield return new TestCaseData((object)null!).SetName("Saving_refuses_a_missing_list");
        yield return new TestCaseData((object)All(order: ["feed", "sleep", "diaper", "pump", "growth"]))
            .SetName("Saving_refuses_a_list_with_a_missing_key");
        yield return new TestCaseData((object)All(order: ["feed", "feed", "sleep", "diaper", "pump", "growth", "health"]))
            .SetName("Saving_refuses_a_list_with_a_duplicate_key");
        yield return new TestCaseData((object)All(order: ["feed", "bath", "sleep", "diaper", "pump", "growth", "health"]))
            .SetName("Saving_refuses_a_list_with_an_unknown_key");
    }

    [TestCaseSource(nameof(InvalidLists))]
    public async Task Saving_refuses_a_list_without_every_known_key_exactly_once(SectionSetting[]? input)
    {
        var result = await _service.SaveAsync(_anna, input);

        Assert.That(((SaveSectionsResult.Invalid)result).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["sections"] = "invalid" }));
        Assert.That(_preferences.Preferences, Is.Empty);
    }

    [Test]
    public async Task Saving_refuses_a_list_with_no_visible_section()
    {
        var result = await _service.SaveAsync(_anna, All(visible: false));

        Assert.That(((SaveSectionsResult.Invalid)result).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["sections"] = "noneVisible" }));
        Assert.That(_preferences.Preferences, Is.Empty);
    }
}
