using Nala.Core.Babies;
using Nala.Core.Diapers;
using Nala.Core.Entries;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class DiaperServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private FakeDiaperRepository _diapers = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private DiaperService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _diapers = new FakeDiaperRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new DiaperService(_diapers, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _diapers.Names[user.Id] = name;
        return user;
    }

    private static DiaperInput Diaper(int minutesAgo = 10, bool wet = true, bool dirty = false, bool rash = false, string? notes = null) =>
        new(Now.AddMinutes(-minutesAgo), wet, dirty, rash, notes);

    private async Task<DiaperEntry> CreateAsync(User actor, DiaperInput input, Guid? id = null) =>
        ((CreateDiaperResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, input)).Entry;

    [Test]
    public async Task Creating_a_diaper_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, Diaper(wet: true, dirty: true, rash: true, notes: " big one "), id);

        var diaper = _diapers.Diapers.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.Diaper, Is.SameAs(diaper));
            Assert.That(diaper.Id, Is.EqualTo(id));
            Assert.That(diaper.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(diaper.Time, Is.EqualTo(Now.AddMinutes(-10)));
            Assert.That(diaper.Wet, Is.True);
            Assert.That(diaper.Dirty, Is.True);
            Assert.That(diaper.Rash, Is.True);
            Assert.That(diaper.Notes, Is.EqualTo("big one"));
            Assert.That(diaper.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(diaper.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(diaper.CreatedAt, Is.EqualTo(Now));
            Assert.That(diaper.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task A_dry_diaper_is_stored_with_neither_wet_nor_dirty()
    {
        var entry = await CreateAsync(_anna, Diaper(wet: false, dirty: false));

        Assert.That((entry.Diaper.Wet, entry.Diaper.Dirty, entry.Diaper.Rash), Is.EqualTo((false, false, false)));
    }

    [Test]
    public async Task A_dirty_diaper_stores_its_colour_and_consistency()
    {
        var entry = await CreateAsync(_anna, Diaper(dirty: true) with { Color = "green", Consistency = "runny" });

        Assert.That((entry.Diaper.Color, entry.Diaper.Consistency), Is.EqualTo(((DiaperColor?)DiaperColor.Green, (DiaperConsistency?)DiaperConsistency.Runny)));
    }

    [Test]
    public async Task Colour_and_consistency_are_dropped_when_not_dirty()
    {
        var created = await CreateAsync(_anna, Diaper(dirty: false) with { Color = "green", Consistency = "runny" });
        Assert.That((created.Diaper.Color, created.Diaper.Consistency), Is.EqualTo(((DiaperColor?)null, (DiaperConsistency?)null)));

        var dirty = await CreateAsync(_anna, Diaper(dirty: true) with { Color = "black", Consistency = "hard" });
        var result = await _service.UpdateAsync(_ben, dirty.Diaper.Id, Diaper(dirty: false) with { Color = "black", Consistency = "hard" });

        var updated = ((UpdateDiaperResult.Updated)result).Entry.Diaper;
        Assert.That((updated.Color, updated.Consistency), Is.EqualTo(((DiaperColor?)null, (DiaperConsistency?)null)));
    }

    [Test]
    public async Task Blank_notes_are_stored_as_none()
    {
        var entry = await CreateAsync(_anna, Diaper(notes: "   "));

        Assert.That(entry.Diaper.Notes, Is.Null);
    }

    [Test]
    public async Task Resending_an_existing_id_returns_the_stored_diaper_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, Diaper(notes: "first"), id);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, Diaper(minutesAgo: 2, dirty: true, notes: "second"));

        var existing = (CreateDiaperResult.AlreadyExists)result;
        Assert.That(existing.Entry.Diaper.Notes, Is.EqualTo("first"));
        Assert.That(existing.Entry.Diaper.Dirty, Is.False);
        Assert.That(_diapers.Diapers, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Creating_refuses_invalid_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Diaper(minutesAgo: 5) with { Time = null });

        Assert.That(((CreateDiaperResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["time"] = "required" }));
        Assert.That(_diapers.Diapers, Is.Empty);
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Diaper());

        Assert.That(result, Is.TypeOf<CreateDiaperResult.BabyNotFound>());
    }

    [Test]
    public async Task Any_member_updates_a_diaper_and_the_update_records_who_and_when()
    {
        var created = await CreateAsync(_anna, Diaper());
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.Diaper.Id, Diaper(minutesAgo: 20, wet: false, dirty: true, rash: true, notes: "oops"));

        var updated = ((UpdateDiaperResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.Diaper.Time, Is.EqualTo(Now.AddMinutes(-20)));
            Assert.That(updated.Diaper.Wet, Is.False);
            Assert.That(updated.Diaper.Dirty, Is.True);
            Assert.That(updated.Diaper.Rash, Is.True);
            Assert.That(updated.Diaper.Notes, Is.EqualTo("oops"));
            Assert.That(updated.Diaper.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(updated.Diaper.CreatedAt, Is.EqualTo(Now));
            Assert.That(updated.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(updated.Diaper.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Updating_refuses_invalid_fields_and_keeps_the_diaper()
    {
        var created = await CreateAsync(_anna, Diaper());

        var result = await _service.UpdateAsync(_ben, created.Diaper.Id, Diaper() with { Time = null });

        Assert.That(((UpdateDiaperResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["time"] = "required" }));
        Assert.That(created.Diaper.Time, Is.EqualTo(Now.AddMinutes(-10)));
    }

    [Test]
    public async Task Updating_an_unknown_diaper_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_anna, Guid.NewGuid(), Diaper()), Is.TypeOf<UpdateDiaperResult.NotFound>());

    [Test]
    public async Task Deleting_removes_the_diaper()
    {
        var created = await CreateAsync(_anna, Diaper());

        Assert.That(await _service.DeleteAsync(created.Diaper.Id), Is.TypeOf<DeleteDiaperResult.Deleted>());
        Assert.That(_diapers.Diapers, Is.Empty);
        Assert.That(await _service.DeleteAsync(created.Diaper.Id), Is.TypeOf<DeleteDiaperResult.NotFound>());
    }

    [Test]
    public async Task A_diaper_is_read_back_by_id()
    {
        var created = await CreateAsync(_anna, Diaper());

        Assert.That((await _service.GetAsync(created.Diaper.Id))?.Diaper.Id, Is.EqualTo(created.Diaper.Id));
        Assert.That(await _service.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Pages_are_newest_first_with_a_cursor_to_the_next()
    {
        for (var i = 1; i <= 5; i++)
        {
            await CreateAsync(_anna, Diaper(minutesAgo: i * 100));
        }

        var first = (ListDiapersResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListDiapersResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);
        var last = (ListDiapersResult.Page)await _service.ListAsync(_lea.Id, second.Next, 2);

        Assert.Multiple(() =>
        {
            Assert.That(first.Entries.Select(e => e.Diaper.Time), Is.EqualTo(new[] { Now.AddMinutes(-100), Now.AddMinutes(-200) }));
            Assert.That(second.Entries.Select(e => e.Diaper.Time), Is.EqualTo(new[] { Now.AddMinutes(-300), Now.AddMinutes(-400) }));
            Assert.That(last.Entries.Select(e => e.Diaper.Time), Is.EqualTo(new[] { Now.AddMinutes(-500) }));
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
            await CreateAsync(_anna, Diaper(minutesAgo: i * 10));
        }

        var page = (ListDiapersResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task A_malformed_cursor_is_refused() =>
        Assert.That(await _service.ListAsync(_lea.Id, "not a cursor", null), Is.TypeOf<ListDiapersResult.InvalidCursor>());

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.TypeOf<ListDiapersResult.BabyNotFound>());
}
