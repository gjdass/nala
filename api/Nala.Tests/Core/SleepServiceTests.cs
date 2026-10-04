using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Sleeps;
using Nala.Core.Users;
using Nala.Tests.Support;
using SleepTimerResult = Nala.Core.Entries.TimerResult<Nala.Core.Sleeps.SleepEntry>;

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

    private async Task<SleepTimerResult> StartAsync(Guid id, DateTimeOffset? at = null, Baby? baby = null, bool queued = false, User? actor = null) =>
        await _service.StartAsync(actor ?? _anna, id, (baby ?? _lea).Id, at ?? Now, queued);

    private async Task<Sleep> StartLiveAsync(int minutesAgo = 30)
    {
        var id = Guid.NewGuid();
        await StartAsync(id, Now.AddMinutes(-minutesAgo));
        return _sleeps.Sleeps.Single(s => s.Id == id);
    }

    [Test]
    public async Task Start_on_an_unknown_id_creates_a_live_sleep_starting_at_the_tap()
    {
        var id = Guid.NewGuid();

        var result = await StartAsync(id, Now.AddMinutes(-2));

        var sleep = _sleeps.Sleeps.Single();
        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<SleepTimerResult.Created>());
            Assert.That(((SleepTimerResult.Created)result).Entry.Sleep, Is.SameAs(sleep));
            Assert.That(sleep.Id, Is.EqualTo(id));
            Assert.That(sleep.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(sleep.StartTime, Is.EqualTo(Now.AddMinutes(-2)));
            Assert.That(sleep.EndTime, Is.Null);
            Assert.That(sleep.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(sleep.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(sleep.CreatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Start_for_an_unknown_baby_is_refused() =>
        Assert.That(
            await _service.StartAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Now),
            Is.TypeOf<SleepTimerResult.BabyNotFound>());

    [Test]
    public async Task Start_needs_a_time_not_in_the_future()
    {
        var missing = await _service.StartAsync(_anna, Guid.NewGuid(), _lea.Id, null);
        var future = await StartAsync(Guid.NewGuid(), Now.AddMinutes(2));

        Assert.Multiple(() =>
        {
            Assert.That(((SleepTimerResult.Invalid)missing).Errors, Is.EqualTo(new Dictionary<string, string> { ["at"] = "required" }));
            Assert.That(((SleepTimerResult.Invalid)future).Errors, Is.EqualTo(new Dictionary<string, string> { ["at"] = "inFuture" }));
            Assert.That(_sleeps.Sleeps, Is.Empty);
        });
    }

    [Test]
    public async Task Start_on_a_stopped_sleep_makes_it_live_again_from_its_start_time()
    {
        var stopped = (await CreateAsync(_anna, Sleep(startMinutesAgo: 90, endMinutesAgo: 30))).Sleep;
        _time.Now = Now.AddMinutes(5);

        var result = await StartAsync(stopped.Id, Now.AddMinutes(5), actor: _ben);

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<SleepTimerResult.Updated>());
            Assert.That(stopped.EndTime, Is.Null);
            Assert.That(stopped.StartTime, Is.EqualTo(Now.AddMinutes(-90)));
            Assert.That(stopped.UpdatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(stopped.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Start_on_a_stopped_sleep_before_its_start_time_is_refused()
    {
        var stopped = (await CreateAsync(_anna, Sleep(startMinutesAgo: 90, endMinutesAgo: 30))).Sleep;

        var result = await StartAsync(stopped.Id, Now.AddMinutes(-100));

        Assert.Multiple(() =>
        {
            Assert.That(((SleepTimerResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["at"] = "invalid" }));
            Assert.That(stopped.EndTime, Is.EqualTo(Now.AddMinutes(-30)));
        });
    }

    [Test]
    public async Task Start_on_a_live_sleep_changes_nothing()
    {
        var live = await StartLiveAsync();
        _time.Now = Now.AddMinutes(1);

        var result = await StartAsync(live.Id, Now.AddMinutes(1), actor: _ben);

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<SleepTimerResult.Updated>());
            Assert.That(live.StartTime, Is.EqualTo(Now.AddMinutes(-30)));
            Assert.That(live.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(live.UpdatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Start_while_another_sleep_of_the_baby_is_live_is_refused()
    {
        await StartLiveAsync();
        var stopped = (await CreateAsync(_anna, Sleep())).Sleep;

        var created = await StartAsync(Guid.NewGuid());
        var restarted = await StartAsync(stopped.Id);

        Assert.Multiple(() =>
        {
            Assert.That(created, Is.TypeOf<SleepTimerResult.InProgressExists>());
            Assert.That(restarted, Is.TypeOf<SleepTimerResult.InProgressExists>());
            Assert.That(stopped.EndTime, Is.Not.Null);
            Assert.That(_sleeps.Sleeps.Count(s => s.EndTime is null), Is.EqualTo(1));
        });
    }

    [Test]
    public async Task Another_babys_live_sleep_does_not_stop_a_start()
    {
        var tom = new Baby { Id = Guid.NewGuid(), Name = "Tom", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(tom);
        await StartAsync(Guid.NewGuid(), baby: tom);

        Assert.That(await StartAsync(Guid.NewGuid()), Is.TypeOf<SleepTimerResult.Created>());
    }

    [Test]
    public async Task A_start_queued_offline_is_kept_while_another_sleep_is_live()
    {
        await StartLiveAsync();

        var result = await StartAsync(Guid.NewGuid(), Now.AddMinutes(-10), queued: true);

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<SleepTimerResult.Created>());
            Assert.That(_sleeps.Sleeps.Count(s => s.EndTime is null), Is.EqualTo(2));
        });
    }

    [Test]
    public async Task Stop_ends_the_live_sleep_at_the_tap()
    {
        var live = await StartLiveAsync();
        _time.Now = Now.AddMinutes(1);

        var result = await _service.StopAsync(_ben, live.Id, Now);

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<SleepTimerResult.Updated>());
            Assert.That(live.EndTime, Is.EqualTo(Now));
            Assert.That(live.UpdatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(live.UpdatedAt, Is.EqualTo(Now.AddMinutes(1)));
        });
    }

    [Test]
    public async Task Stop_on_a_stopped_sleep_changes_nothing()
    {
        var stopped = (await CreateAsync(_anna, Sleep())).Sleep;

        var result = await _service.StopAsync(_ben, stopped.Id, Now);

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<SleepTimerResult.Updated>());
            Assert.That(stopped.EndTime, Is.EqualTo(Now.AddMinutes(-60)));
            Assert.That(stopped.UpdatedByUserId, Is.EqualTo(_anna.Id));
        });
    }

    [Test]
    public async Task Stop_before_the_start_time_is_refused()
    {
        var live = await StartLiveAsync(minutesAgo: 30);

        var result = await _service.StopAsync(_anna, live.Id, Now.AddMinutes(-40));

        Assert.Multiple(() =>
        {
            Assert.That(((SleepTimerResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["at"] = "invalid" }));
            Assert.That(live.EndTime, Is.Null);
        });
    }

    [Test]
    public async Task Stop_needs_its_time() =>
        Assert.That(
            ((SleepTimerResult.Invalid)await _service.StopAsync(_anna, Guid.NewGuid(), null)).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["at"] = "required" }));

    [Test]
    public async Task Stop_on_an_unknown_sleep_is_not_found() =>
        Assert.That(await _service.StopAsync(_anna, Guid.NewGuid(), Now), Is.TypeOf<SleepTimerResult.NotFound>());

    [Test]
    public async Task Updating_a_live_sleep_keeps_it_live()
    {
        var live = await StartLiveAsync(minutesAgo: 30);

        var result = await _service.UpdateAsync(_ben, live.Id, new SleepInput(Now.AddMinutes(-45), null, "cot"));

        Assert.Multiple(() =>
        {
            Assert.That(result, Is.TypeOf<UpdateSleepResult.Updated>());
            Assert.That(live.StartTime, Is.EqualTo(Now.AddMinutes(-45)));
            Assert.That(live.EndTime, Is.Null);
            Assert.That(live.Notes, Is.EqualTo("cot"));
            Assert.That(live.UpdatedByUserId, Is.EqualTo(_ben.Id));
        });
    }

    [Test]
    public async Task Updating_a_live_sleep_with_an_end_time_is_refused()
    {
        var live = await StartLiveAsync();

        var result = await _service.UpdateAsync(_anna, live.Id, Sleep());

        Assert.Multiple(() =>
        {
            Assert.That(((UpdateSleepResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["endTime"] = "notAllowed" }));
            Assert.That(live.EndTime, Is.Null);
        });
    }

    [Test]
    public async Task Live_sleeps_of_every_baby_are_listed_oldest_first()
    {
        var tom = new Baby { Id = Guid.NewGuid(), Name = "Tom", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(tom);
        var recent = await StartLiveAsync(minutesAgo: 10);
        var tomId = Guid.NewGuid();
        await StartAsync(tomId, Now.AddMinutes(-50), baby: tom);
        await CreateAsync(_anna, Sleep());

        var live = await _service.ListLiveAsync();

        Assert.That(live.Select(e => e.Sleep.Id), Is.EqualTo(new[] { tomId, recent.Id }));
    }
}
