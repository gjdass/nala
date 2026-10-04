using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.HealthEntries;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class HealthEntryServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private FakeHealthEntryRepository _healthEntries = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private HealthEntryService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _healthEntries = new FakeHealthEntryRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new HealthEntryService(_healthEntries, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _healthEntries.Names[user.Id] = name;
        return user;
    }

    private static HealthEntryInput HealthEntry(
        int minutesAgo = 10, string? name = "Paracetamol", decimal? amount = 2.5m, string? unit = "ml", decimal? temperature = null, string? notes = null) =>
        new(Now.AddMinutes(-minutesAgo), name, amount, unit, temperature, notes);

    private async Task<HealthEntryDetails> CreateAsync(User actor, HealthEntryInput input, Guid? id = null) =>
        ((CreateHealthEntryResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, input)).Entry;

    [Test]
    public async Task Creating_a_dose_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, HealthEntry(name: " Vitamin D ", amount: 4m, unit: "drops", notes: " morning "), id);

        var healthEntry = _healthEntries.HealthEntries.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.HealthEntry, Is.SameAs(healthEntry));
            Assert.That(healthEntry.Id, Is.EqualTo(id));
            Assert.That(healthEntry.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(healthEntry.Time, Is.EqualTo(Now.AddMinutes(-10)));
            Assert.That(healthEntry.Name, Is.EqualTo("Vitamin D"));
            Assert.That(healthEntry.Amount, Is.EqualTo(4m));
            Assert.That(healthEntry.Unit, Is.EqualTo(DoseUnit.Drops));
            Assert.That(healthEntry.Notes, Is.EqualTo("morning"));
            Assert.That(healthEntry.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(healthEntry.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(healthEntry.CreatedAt, Is.EqualTo(Now));
            Assert.That(healthEntry.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task The_unit_is_dropped_without_an_amount()
    {
        var created = await CreateAsync(_anna, HealthEntry(amount: null, unit: "mg"));
        Assert.That((created.HealthEntry.Amount, created.HealthEntry.Unit), Is.EqualTo(((decimal?)null, (DoseUnit?)null)));

        var result = await _service.UpdateAsync(_ben, created.HealthEntry.Id, HealthEntry(amount: null, unit: "drops"));

        var updated = ((UpdateHealthEntryResult.Updated)result).Entry.HealthEntry;
        Assert.That(updated.Unit, Is.Null);
    }

    [Test]
    public async Task A_temperature_alone_is_stored_without_a_name()
    {
        var entry = await CreateAsync(_anna, HealthEntry(name: "  ", amount: null, unit: null, temperature: 38.5m));

        Assert.That((entry.HealthEntry.Name, entry.HealthEntry.Temperature), Is.EqualTo(((string?)null, (decimal?)38.5m)));
    }

    [Test]
    public async Task Updating_replaces_the_temperature()
    {
        var created = await CreateAsync(_anna, HealthEntry(temperature: 38.5m));

        var changed = ((UpdateHealthEntryResult.Updated)await _service.UpdateAsync(_ben, created.HealthEntry.Id, HealthEntry(temperature: 37.2m))).Entry;
        Assert.That(changed.HealthEntry.Temperature, Is.EqualTo(37.2m));

        var cleared = ((UpdateHealthEntryResult.Updated)await _service.UpdateAsync(_ben, created.HealthEntry.Id, HealthEntry())).Entry;
        Assert.That(cleared.HealthEntry.Temperature, Is.Null);
    }

    [Test]
    public async Task Blank_notes_are_stored_as_none()
    {
        var entry = await CreateAsync(_anna, HealthEntry(notes: "   "));

        Assert.That(entry.HealthEntry.Notes, Is.Null);
    }

    [Test]
    public async Task Resending_an_existing_id_returns_the_stored_dose_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, HealthEntry(name: "Paracetamol"), id);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, HealthEntry(minutesAgo: 2, name: "Ibuprofen"));

        var existing = (CreateHealthEntryResult.AlreadyExists)result;
        Assert.That(existing.Entry.HealthEntry.Name, Is.EqualTo("Paracetamol"));
        Assert.That(_healthEntries.HealthEntries, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Creating_refuses_invalid_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, HealthEntry(name: " ", unit: null));

        Assert.That(
            ((CreateHealthEntryResult.Invalid)result).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["name"] = "required", ["amount"] = "nameRequired", ["unit"] = "required" }));
        Assert.That(_healthEntries.HealthEntries, Is.Empty);
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), HealthEntry());

        Assert.That(result, Is.TypeOf<CreateHealthEntryResult.BabyNotFound>());
    }

    [Test]
    public async Task Any_member_updates_a_dose_and_the_update_records_who_and_when()
    {
        var created = await CreateAsync(_anna, HealthEntry());
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.HealthEntry.Id, HealthEntry(minutesAgo: 20, name: "Ibuprofen", amount: 50m, unit: "mg", notes: "fever"));

        var updated = ((UpdateHealthEntryResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.HealthEntry.Time, Is.EqualTo(Now.AddMinutes(-20)));
            Assert.That(updated.HealthEntry.Name, Is.EqualTo("Ibuprofen"));
            Assert.That(updated.HealthEntry.Amount, Is.EqualTo(50m));
            Assert.That(updated.HealthEntry.Unit, Is.EqualTo(DoseUnit.Mg));
            Assert.That(updated.HealthEntry.Notes, Is.EqualTo("fever"));
            Assert.That(updated.HealthEntry.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(updated.HealthEntry.CreatedAt, Is.EqualTo(Now));
            Assert.That(updated.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(updated.HealthEntry.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Updating_refuses_invalid_fields_and_keeps_the_dose()
    {
        var created = await CreateAsync(_anna, HealthEntry());

        var result = await _service.UpdateAsync(_ben, created.HealthEntry.Id, HealthEntry(amount: 2000m));

        Assert.That(((UpdateHealthEntryResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["amount"] = "outOfRange" }));
        Assert.That(created.HealthEntry.Amount, Is.EqualTo(2.5m));
    }

    [Test]
    public async Task Updating_an_unknown_dose_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_anna, Guid.NewGuid(), HealthEntry()), Is.TypeOf<UpdateHealthEntryResult.NotFound>());

    [Test]
    public async Task Deleting_removes_the_dose()
    {
        var created = await CreateAsync(_anna, HealthEntry());

        Assert.That(await _service.DeleteAsync(created.HealthEntry.Id), Is.TypeOf<DeleteHealthEntryResult.Deleted>());
        Assert.That(_healthEntries.HealthEntries, Is.Empty);
        Assert.That(await _service.DeleteAsync(created.HealthEntry.Id), Is.TypeOf<DeleteHealthEntryResult.NotFound>());
    }

    [Test]
    public async Task A_dose_is_read_back_by_id()
    {
        var created = await CreateAsync(_anna, HealthEntry());

        Assert.That((await _service.GetAsync(created.HealthEntry.Id))?.HealthEntry.Id, Is.EqualTo(created.HealthEntry.Id));
        Assert.That(await _service.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Pages_are_newest_first_with_a_cursor_to_the_next()
    {
        for (var i = 1; i <= 5; i++)
        {
            await CreateAsync(_anna, HealthEntry(minutesAgo: i * 100));
        }

        var first = (ListHealthEntriesResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListHealthEntriesResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);
        var last = (ListHealthEntriesResult.Page)await _service.ListAsync(_lea.Id, second.Next, 2);

        Assert.Multiple(() =>
        {
            Assert.That(first.Entries.Select(e => e.HealthEntry.Time), Is.EqualTo(new[] { Now.AddMinutes(-100), Now.AddMinutes(-200) }));
            Assert.That(second.Entries.Select(e => e.HealthEntry.Time), Is.EqualTo(new[] { Now.AddMinutes(-300), Now.AddMinutes(-400) }));
            Assert.That(last.Entries.Select(e => e.HealthEntry.Time), Is.EqualTo(new[] { Now.AddMinutes(-500) }));
            Assert.That(last.Next, Is.Null);
        });
    }

    [TestCase(null, 20)]
    [TestCase(0, 1)]
    [TestCase(80, 50)]
    public async Task The_page_size_defaults_to_20_and_stays_within_1_to_50(int? limit, int expected)
    {
        for (var i = 1; i <= 60; i++)
        {
            await CreateAsync(_anna, HealthEntry(minutesAgo: i * 10));
        }

        var page = (ListHealthEntriesResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task A_malformed_cursor_is_refused() =>
        Assert.That(await _service.ListAsync(_lea.Id, "not a cursor", null), Is.TypeOf<ListHealthEntriesResult.InvalidCursor>());

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.TypeOf<ListHealthEntriesResult.BabyNotFound>());

    [Test]
    public async Task Recent_doses_of_an_unknown_baby_are_refused() =>
        Assert.That(await _service.RecentAsync(Guid.NewGuid()), Is.TypeOf<RecentMedicinesResult.BabyNotFound>());

    [Test]
    public async Task Recent_doses_are_the_5_latest_names_of_the_baby()
    {
        await CreateAsync(_anna, HealthEntry(name: "Paracetamol", amount: 2.5m, unit: "ml"));

        var found = (RecentMedicinesResult.Found)await _service.RecentAsync(_lea.Id);

        Assert.Multiple(() =>
        {
            Assert.That(_healthEntries.LastRecentLimit, Is.EqualTo(5));
            Assert.That(found.HealthEntries, Is.EqualTo(new[] { new RecentMedicine("Paracetamol", 2.5m, DoseUnit.Ml) }));
        });
    }
}
