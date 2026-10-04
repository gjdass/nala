using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.GrowthEntries;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class GrowthEntryServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private FakeGrowthEntryRepository _growthEntries = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private GrowthEntryService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _growthEntries = new FakeGrowthEntryRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new GrowthEntryService(_growthEntries, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _growthEntries.Names[user.Id] = name;
        return user;
    }

    private static GrowthEntryInput Measurement(
        int day = 28, decimal? weightG = 4250m, decimal? lengthCm = 55.5m, decimal? headCircumferenceCm = 38m, string? notes = null) =>
        new(new DateOnly(2026, 9, day), weightG, lengthCm, headCircumferenceCm, notes);

    private async Task<GrowthEntryDetails> CreateAsync(User actor, GrowthEntryInput input, Guid? id = null) =>
        ((CreateGrowthEntryResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, "measurement", input)).Entry;

    [Test]
    public async Task Creating_a_measurement_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, Measurement(notes: " doctor "), id);

        var growthEntry = _growthEntries.GrowthEntries.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.GrowthEntry, Is.SameAs(growthEntry));
            Assert.That(growthEntry.Id, Is.EqualTo(id));
            Assert.That(growthEntry.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(growthEntry.Kind, Is.EqualTo(GrowthKind.Measurement));
            Assert.That(growthEntry.Date, Is.EqualTo(new DateOnly(2026, 9, 28)));
            Assert.That(growthEntry.WeightG, Is.EqualTo(4250));
            Assert.That(growthEntry.LengthCm, Is.EqualTo(55.5m));
            Assert.That(growthEntry.HeadCircumferenceCm, Is.EqualTo(38m));
            Assert.That(growthEntry.Notes, Is.EqualTo("doctor"));
            Assert.That(growthEntry.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(growthEntry.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(growthEntry.CreatedAt, Is.EqualTo(Now));
            Assert.That(growthEntry.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task Missing_values_are_stored_as_none()
    {
        var entry = await CreateAsync(_anna, Measurement(lengthCm: null, headCircumferenceCm: null, notes: "  "));

        Assert.Multiple(() =>
        {
            Assert.That(entry.GrowthEntry.WeightG, Is.EqualTo(4250));
            Assert.That(entry.GrowthEntry.LengthCm, Is.Null);
            Assert.That(entry.GrowthEntry.HeadCircumferenceCm, Is.Null);
            Assert.That(entry.GrowthEntry.Notes, Is.Null);
        });
    }

    [Test]
    public async Task Resending_an_existing_id_returns_the_stored_entry_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, Measurement(weightG: 4250m), id);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, "measurement", Measurement(weightG: 5000m));

        Assert.That(((CreateGrowthEntryResult.AlreadyExists)result).Entry.GrowthEntry.WeightG, Is.EqualTo(4250));
        Assert.That(_growthEntries.GrowthEntries, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Creating_refuses_invalid_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, "measurement", Measurement(weightG: 100m));

        Assert.That(((CreateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["weightG"] = "outOfRange" }));
        Assert.That(_growthEntries.GrowthEntries, Is.Empty);
    }

    [Test]
    public async Task Creating_refuses_a_date_before_the_birth_of_that_baby()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, "measurement", Measurement() with { Date = new DateOnly(2026, 8, 31) });

        Assert.That(((CreateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["date"] = "beforeBirth" }));
    }

    [TestCase(null, "required")]
    [TestCase("photo", "invalid")]
    public async Task Creating_refuses_a_missing_or_unknown_kind(string? kind, string code)
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, kind, Measurement());

        Assert.That(((CreateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["kind"] = code }));
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), "measurement", Measurement());

        Assert.That(result, Is.TypeOf<CreateGrowthEntryResult.BabyNotFound>());
    }

    [Test]
    public async Task Any_member_updates_an_entry_and_the_update_records_who_and_when()
    {
        var created = await CreateAsync(_anna, Measurement());
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.GrowthEntry.Id, Measurement(day: 30, weightG: 4400m, lengthCm: null, headCircumferenceCm: 38.5m, notes: "home scale"));

        var updated = ((UpdateGrowthEntryResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.GrowthEntry.Date, Is.EqualTo(new DateOnly(2026, 9, 30)));
            Assert.That(updated.GrowthEntry.WeightG, Is.EqualTo(4400));
            Assert.That(updated.GrowthEntry.LengthCm, Is.Null);
            Assert.That(updated.GrowthEntry.HeadCircumferenceCm, Is.EqualTo(38.5m));
            Assert.That(updated.GrowthEntry.Notes, Is.EqualTo("home scale"));
            Assert.That(updated.GrowthEntry.Kind, Is.EqualTo(GrowthKind.Measurement));
            Assert.That(updated.GrowthEntry.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(updated.GrowthEntry.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(updated.GrowthEntry.CreatedAt, Is.EqualTo(Now));
            Assert.That(updated.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(updated.GrowthEntry.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Updating_refuses_invalid_fields_and_keeps_the_entry()
    {
        var created = await CreateAsync(_anna, Measurement());

        var result = await _service.UpdateAsync(_ben, created.GrowthEntry.Id, Measurement(lengthCm: 200m));

        Assert.That(((UpdateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["lengthCm"] = "outOfRange" }));
        Assert.That(created.GrowthEntry.LengthCm, Is.EqualTo(55.5m));
    }

    [Test]
    public async Task Updating_refuses_a_date_before_the_birth()
    {
        var created = await CreateAsync(_anna, Measurement());

        var result = await _service.UpdateAsync(_ben, created.GrowthEntry.Id, Measurement() with { Date = new DateOnly(2026, 8, 1) });

        Assert.That(((UpdateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["date"] = "beforeBirth" }));
    }

    [Test]
    public async Task Updating_an_unknown_entry_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_anna, Guid.NewGuid(), Measurement()), Is.TypeOf<UpdateGrowthEntryResult.NotFound>());

    [Test]
    public async Task Deleting_removes_the_entry()
    {
        var created = await CreateAsync(_anna, Measurement());

        Assert.That(await _service.DeleteAsync(created.GrowthEntry.Id), Is.TypeOf<DeleteGrowthEntryResult.Deleted>());
        Assert.That(_growthEntries.GrowthEntries, Is.Empty);
        Assert.That(await _service.DeleteAsync(created.GrowthEntry.Id), Is.TypeOf<DeleteGrowthEntryResult.NotFound>());
    }

    [Test]
    public async Task An_entry_is_read_back_by_id()
    {
        var created = await CreateAsync(_anna, Measurement());

        Assert.That((await _service.GetAsync(created.GrowthEntry.Id))?.GrowthEntry.Id, Is.EqualTo(created.GrowthEntry.Id));
        Assert.That(await _service.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Pages_are_newest_date_first_then_newest_created_with_a_cursor_to_the_next()
    {
        var sameDayOlder = await CreateAsync(_anna, Measurement(day: 20));
        _time.Now = Now.AddMinutes(1);
        var sameDayNewer = await CreateAsync(_anna, Measurement(day: 20));
        var latest = await CreateAsync(_anna, Measurement(day: 25));
        var oldest = await CreateAsync(_anna, Measurement(day: 2));

        var first = (ListGrowthEntriesResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListGrowthEntriesResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);

        Assert.Multiple(() =>
        {
            Assert.That(first.Entries.Select(e => e.GrowthEntry.Id), Is.EqualTo(new[] { latest.GrowthEntry.Id, sameDayNewer.GrowthEntry.Id }));
            Assert.That(second.Entries.Select(e => e.GrowthEntry.Id), Is.EqualTo(new[] { sameDayOlder.GrowthEntry.Id, oldest.GrowthEntry.Id }));
            Assert.That(second.Next, Is.Null);
        });
    }

    [TestCase(null, 20)]
    [TestCase(0, 1)]
    [TestCase(80, 50)]
    public async Task The_page_size_defaults_to_20_and_stays_within_1_to_50(int? limit, int expected)
    {
        for (var i = 1; i <= 60; i++)
        {
            await CreateAsync(_anna, Measurement(day: 1 + (i % 30)));
        }

        var page = (ListGrowthEntriesResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task A_malformed_cursor_is_refused() =>
        Assert.That(await _service.ListAsync(_lea.Id, "not a cursor", null), Is.TypeOf<ListGrowthEntriesResult.InvalidCursor>());

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.TypeOf<ListGrowthEntriesResult.BabyNotFound>());

    [Test]
    public async Task Latest_takes_each_measure_from_its_most_recent_measurement()
    {
        await CreateAsync(_anna, Measurement(day: 10, weightG: 3800m, lengthCm: 52m, headCircumferenceCm: 36m));
        await CreateAsync(_anna, Measurement(day: 20, weightG: 4100m, lengthCm: null, headCircumferenceCm: null));

        var latest = ((LatestGrowthResult.Found)await _service.LatestAsync(_lea.Id)).Latest;

        Assert.That(latest, Is.EqualTo(new GrowthLatest(
            new LatestMeasure(4100m, new DateOnly(2026, 9, 20), false),
            new LatestMeasure(52m, new DateOnly(2026, 9, 10), false),
            new LatestMeasure(36m, new DateOnly(2026, 9, 10), false))));
    }

    [Test]
    public async Task Latest_falls_back_to_the_birth_fields_then_to_none()
    {
        _lea.BirthWeightG = 3200;
        _lea.BirthLengthCm = 49.5m;
        await CreateAsync(_anna, Measurement(weightG: null, lengthCm: 54m, headCircumferenceCm: null));

        var latest = ((LatestGrowthResult.Found)await _service.LatestAsync(_lea.Id)).Latest;

        Assert.That(latest, Is.EqualTo(new GrowthLatest(
            new LatestMeasure(3200m, _lea.BirthDate, true),
            new LatestMeasure(54m, new DateOnly(2026, 9, 28), false),
            null)));
    }

    [Test]
    public async Task Latest_of_an_unknown_baby_is_refused() =>
        Assert.That(await _service.LatestAsync(Guid.NewGuid()), Is.TypeOf<LatestGrowthResult.BabyNotFound>());

    private static GrowthEntryInput Milestone(string milestone = "firstTooth", string? title = null, int day = 28, string? notes = null) =>
        new(new DateOnly(2026, 9, day), null, null, null, notes, milestone, title);

    private async Task<GrowthEntryDetails> CreateMilestoneAsync(GrowthEntryInput input) =>
        ((CreateGrowthEntryResult.Created)await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, "milestone", input)).Entry;

    [Test]
    public async Task Creating_a_preset_milestone_stores_it_without_a_title_nor_values()
    {
        var entry = (await CreateMilestoneAsync(Milestone("firstTooth", "ignored") with { WeightG = 4000m, LengthCm = 50m, HeadCircumferenceCm = 35m })).GrowthEntry;

        Assert.Multiple(() =>
        {
            Assert.That(entry.Kind, Is.EqualTo(GrowthKind.Milestone));
            Assert.That(entry.Milestone, Is.EqualTo(GrowthMilestone.FirstTooth));
            Assert.That(entry.Title, Is.Null);
            Assert.That(entry.WeightG, Is.Null);
            Assert.That(entry.LengthCm, Is.Null);
            Assert.That(entry.HeadCircumferenceCm, Is.Null);
        });
    }

    [Test]
    public async Task Creating_a_custom_milestone_stores_its_trimmed_title()
    {
        var entry = (await CreateMilestoneAsync(Milestone("custom", "  First swim  "))).GrowthEntry;

        Assert.That(entry.Milestone, Is.EqualTo(GrowthMilestone.Custom));
        Assert.That(entry.Title, Is.EqualTo("First swim"));
    }

    [Test]
    public async Task A_measurement_stores_no_milestone_fields()
    {
        var entry = (await CreateAsync(_anna, Measurement() with { Milestone = "custom", Title = "nope" })).GrowthEntry;

        Assert.That(entry.Milestone, Is.Null);
        Assert.That(entry.Title, Is.Null);
    }

    [Test]
    public async Task Creating_refuses_a_custom_milestone_without_a_title()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, "milestone", Milestone("custom"));

        Assert.That(((CreateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["title"] = "required" }));
    }

    [Test]
    public async Task Updating_a_milestone_replaces_its_fields_and_a_preset_clears_the_title()
    {
        var created = await CreateMilestoneAsync(Milestone("custom", "First swim"));

        var result = await _service.UpdateAsync(_ben, created.GrowthEntry.Id, Milestone("firstSteps", "still sent", day: 30, notes: "park"));

        var updated = ((UpdateGrowthEntryResult.Updated)result).Entry.GrowthEntry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.Kind, Is.EqualTo(GrowthKind.Milestone));
            Assert.That(updated.Milestone, Is.EqualTo(GrowthMilestone.FirstSteps));
            Assert.That(updated.Title, Is.Null);
            Assert.That(updated.Date, Is.EqualTo(new DateOnly(2026, 9, 30)));
            Assert.That(updated.Notes, Is.EqualTo("park"));
        });
    }

    [Test]
    public async Task Updating_a_milestone_validates_it_as_a_milestone()
    {
        var created = await CreateMilestoneAsync(Milestone());

        var result = await _service.UpdateAsync(_ben, created.GrowthEntry.Id, Milestone("nope"));

        Assert.That(((UpdateGrowthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["milestone"] = "invalid" }));
    }

    [Test]
    public async Task Latest_ignores_milestones()
    {
        await CreateAsync(_anna, Measurement(day: 10, weightG: 3800m, lengthCm: null, headCircumferenceCm: null));
        await CreateMilestoneAsync(Milestone(day: 20));

        var latest = ((LatestGrowthResult.Found)await _service.LatestAsync(_lea.Id)).Latest;

        Assert.That(latest, Is.EqualTo(new GrowthLatest(new LatestMeasure(3800m, new DateOnly(2026, 9, 10), false), null, null)));
    }
}
