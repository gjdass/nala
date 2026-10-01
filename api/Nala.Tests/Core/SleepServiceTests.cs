using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Sleeps;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class SleepServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private FakeSleepRepository _sleeps = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private SleepService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _sleeps = new FakeSleepRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new SleepService(_sleeps, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _sleeps.Names[user.Id] = name;
        return user;
    }

    private static SleepInput Sleep(int startMinutesAgo = 120, int endMinutesAgo = 60, string? notes = null) =>
        new(Now.AddMinutes(-startMinutesAgo), Now.AddMinutes(-endMinutesAgo), notes);

    private async Task<SleepEntry> CreateAsync(User actor, SleepInput input, Guid? id = null) =>
        ((CreateSleepResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, input)).Entry;

    [Test]
    public async Task Creating_a_sleep_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, Sleep(notes: " stroller "), id);

        var sleep = _sleeps.Sleeps.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.Sleep, Is.SameAs(sleep));
            Assert.That(sleep.Id, Is.EqualTo(id));
            Assert.That(sleep.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(sleep.StartTime, Is.EqualTo(Now.AddMinutes(-120)));
            Assert.That(sleep.EndTime, Is.EqualTo(Now.AddMinutes(-60)));
            Assert.That(sleep.Notes, Is.EqualTo("stroller"));
            Assert.That(sleep.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(sleep.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(sleep.CreatedAt, Is.EqualTo(Now));
            Assert.That(sleep.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task Blank_notes_are_stored_as_none()
    {
        var entry = await CreateAsync(_anna, Sleep(notes: "   "));

        Assert.That(entry.Sleep.Notes, Is.Null);
    }

    [Test]
    public async Task Resending_an_existing_id_returns_the_stored_sleep_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, Sleep(notes: "first"), id);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, Sleep(startMinutesAgo: 30, endMinutesAgo: 10, notes: "second"));

        var existing = (CreateSleepResult.AlreadyExists)result;
        Assert.That(existing.Entry.Sleep.Notes, Is.EqualTo("first"));
        Assert.That(_sleeps.Sleeps, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Creating_refuses_invalid_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Sleep(startMinutesAgo: 60, endMinutesAgo: 90));

        Assert.That(((CreateSleepResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "beforeStart" }));
        Assert.That(_sleeps.Sleeps, Is.Empty);
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Sleep());

        Assert.That(result, Is.TypeOf<CreateSleepResult.BabyNotFound>());
    }

    [Test]
    public async Task Any_member_updates_a_sleep_and_the_update_records_who_and_when()
    {
        var created = await CreateAsync(_anna, Sleep());
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.Sleep.Id, Sleep(startMinutesAgo: 90, endMinutesAgo: 30, notes: "woke up happy"));

        var updated = ((UpdateSleepResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.Sleep.StartTime, Is.EqualTo(Now.AddMinutes(-90)));
            Assert.That(updated.Sleep.EndTime, Is.EqualTo(Now.AddMinutes(-30)));
            Assert.That(updated.Sleep.Notes, Is.EqualTo("woke up happy"));
            Assert.That(updated.Sleep.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(updated.Sleep.CreatedAt, Is.EqualTo(Now));
            Assert.That(updated.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(updated.Sleep.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Updating_refuses_invalid_fields_and_keeps_the_sleep()
    {
        var created = await CreateAsync(_anna, Sleep());

        var result = await _service.UpdateAsync(_ben, created.Sleep.Id, Sleep() with { EndTime = null });

        Assert.That(((UpdateSleepResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "required" }));
        Assert.That(created.Sleep.EndTime, Is.EqualTo(Now.AddMinutes(-60)));
    }

    [Test]
    public async Task Updating_an_unknown_sleep_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_anna, Guid.NewGuid(), Sleep()), Is.TypeOf<UpdateSleepResult.NotFound>());

    [Test]
    public async Task Deleting_removes_the_sleep()
    {
        var created = await CreateAsync(_anna, Sleep());

        Assert.That(await _service.DeleteAsync(created.Sleep.Id), Is.TypeOf<DeleteSleepResult.Deleted>());
        Assert.That(_sleeps.Sleeps, Is.Empty);
        Assert.That(await _service.DeleteAsync(created.Sleep.Id), Is.TypeOf<DeleteSleepResult.NotFound>());
    }

    [Test]
    public async Task A_sleep_is_read_back_by_id()
    {
        var created = await CreateAsync(_anna, Sleep());

        Assert.That((await _service.GetAsync(created.Sleep.Id))?.Sleep.Id, Is.EqualTo(created.Sleep.Id));
        Assert.That(await _service.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Pages_are_newest_first_with_a_cursor_to_the_next()
    {
        for (var i = 1; i <= 5; i++)
        {
            await CreateAsync(_anna, Sleep(startMinutesAgo: i * 100, endMinutesAgo: i * 100 - 30));
        }

        var first = (ListSleepsResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListSleepsResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);
        var last = (ListSleepsResult.Page)await _service.ListAsync(_lea.Id, second.Next, 2);

        Assert.Multiple(() =>
        {
            Assert.That(first.Entries.Select(e => e.Sleep.StartTime), Is.EqualTo(new[] { Now.AddMinutes(-100), Now.AddMinutes(-200) }));
            Assert.That(second.Entries.Select(e => e.Sleep.StartTime), Is.EqualTo(new[] { Now.AddMinutes(-300), Now.AddMinutes(-400) }));
            Assert.That(last.Entries.Select(e => e.Sleep.StartTime), Is.EqualTo(new[] { Now.AddMinutes(-500) }));
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
            await CreateAsync(_anna, Sleep(startMinutesAgo: i * 10 + 5, endMinutesAgo: i * 10));
        }

        var page = (ListSleepsResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task A_malformed_cursor_is_refused() =>
        Assert.That(await _service.ListAsync(_lea.Id, "not a cursor", null), Is.TypeOf<ListSleepsResult.InvalidCursor>());

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.TypeOf<ListSleepsResult.BabyNotFound>());
}
