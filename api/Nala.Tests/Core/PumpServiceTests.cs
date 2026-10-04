using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Pumps;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class PumpServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private FakePumpRepository _pumps = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private PumpService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _pumps = new FakePumpRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new PumpService(_pumps, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _pumps.Names[user.Id] = name;
        return user;
    }

    private static PumpInput Pump(
        int startMinutesAgo = 40, int endMinutesAgo = 20, decimal? leftMl = 90, decimal? rightMl = 80, string? notes = null) =>
        new(Now.AddMinutes(-startMinutesAgo), Now.AddMinutes(-endMinutesAgo), leftMl, rightMl, notes);

    private async Task<PumpEntry> CreateAsync(User actor, PumpInput input, Guid? id = null) =>
        ((CreatePumpResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, input)).Entry;

    [Test]
    public async Task Creating_a_session_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, Pump(notes: " evening "), id);

        var pump = _pumps.Pumps.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.Pump, Is.SameAs(pump));
            Assert.That(pump.Id, Is.EqualTo(id));
            Assert.That(pump.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(pump.StartTime, Is.EqualTo(Now.AddMinutes(-40)));
            Assert.That(pump.EndTime, Is.EqualTo(Now.AddMinutes(-20)));
            Assert.That(pump.LeftMl, Is.EqualTo(90));
            Assert.That(pump.RightMl, Is.EqualTo(80));
            Assert.That(pump.Notes, Is.EqualTo("evening"));
            Assert.That(pump.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(pump.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(pump.CreatedAt, Is.EqualTo(Now));
            Assert.That(pump.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task A_session_without_volumes_or_notes_stores_none()
    {
        var entry = await CreateAsync(_anna, Pump(leftMl: null, rightMl: null, notes: "   "));

        Assert.Multiple(() =>
        {
            Assert.That(entry.Pump.LeftMl, Is.Null);
            Assert.That(entry.Pump.RightMl, Is.Null);
            Assert.That(entry.Pump.Notes, Is.Null);
        });
    }

    [Test]
    public async Task Resending_an_existing_id_returns_the_stored_session_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, Pump(leftMl: 90), id);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, Pump(leftMl: 10));

        Assert.That(((CreatePumpResult.AlreadyExists)result).Entry.Pump.LeftMl, Is.EqualTo(90));
        Assert.That(_pumps.Pumps, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Creating_refuses_invalid_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Pump(leftMl: 501));

        Assert.That(((CreatePumpResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["leftMl"] = "outOfRange" }));
        Assert.That(_pumps.Pumps, Is.Empty);
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused() =>
        Assert.That(await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Pump()), Is.TypeOf<CreatePumpResult.BabyNotFound>());

    [Test]
    public async Task Any_member_updates_a_session_and_the_update_records_who_and_when()
    {
        var created = await CreateAsync(_anna, Pump());
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.Pump.Id, Pump(startMinutesAgo: 50, endMinutesAgo: 30, leftMl: 0, rightMl: null, notes: "only right"));

        var updated = ((UpdatePumpResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.Pump.StartTime, Is.EqualTo(Now.AddMinutes(-50)));
            Assert.That(updated.Pump.EndTime, Is.EqualTo(Now.AddMinutes(-30)));
            Assert.That(updated.Pump.LeftMl, Is.EqualTo(0));
            Assert.That(updated.Pump.RightMl, Is.Null);
            Assert.That(updated.Pump.Notes, Is.EqualTo("only right"));
            Assert.That(updated.Pump.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(updated.Pump.CreatedAt, Is.EqualTo(Now));
            Assert.That(updated.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(updated.Pump.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Updating_refuses_invalid_fields_and_keeps_the_session()
    {
        var created = await CreateAsync(_anna, Pump());

        var result = await _service.UpdateAsync(_ben, created.Pump.Id, Pump(rightMl: 12.5m));

        Assert.That(((UpdatePumpResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["rightMl"] = "invalid" }));
        Assert.That(created.Pump.RightMl, Is.EqualTo(80));
    }

    [Test]
    public async Task Updating_an_unknown_session_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_anna, Guid.NewGuid(), Pump()), Is.TypeOf<UpdatePumpResult.NotFound>());

    [Test]
    public async Task Deleting_removes_the_session()
    {
        var created = await CreateAsync(_anna, Pump());

        Assert.That(await _service.DeleteAsync(created.Pump.Id), Is.TypeOf<DeletePumpResult.Deleted>());
        Assert.That(_pumps.Pumps, Is.Empty);
        Assert.That(await _service.DeleteAsync(created.Pump.Id), Is.TypeOf<DeletePumpResult.NotFound>());
    }

    [Test]
    public async Task A_session_is_read_back_by_id()
    {
        var created = await CreateAsync(_anna, Pump());

        Assert.That((await _service.GetAsync(created.Pump.Id))?.Pump.Id, Is.EqualTo(created.Pump.Id));
        Assert.That(await _service.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Pages_are_newest_first_with_a_cursor_to_the_next()
    {
        for (var i = 1; i <= 5; i++)
        {
            await CreateAsync(_anna, Pump(startMinutesAgo: i * 100, endMinutesAgo: i * 100 - 20));
        }

        var first = (ListPumpsResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListPumpsResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);
        var last = (ListPumpsResult.Page)await _service.ListAsync(_lea.Id, second.Next, 2);

        Assert.Multiple(() =>
        {
            Assert.That(first.Entries.Select(e => e.Pump.StartTime), Is.EqualTo(new[] { Now.AddMinutes(-100), Now.AddMinutes(-200) }));
            Assert.That(second.Entries.Select(e => e.Pump.StartTime), Is.EqualTo(new[] { Now.AddMinutes(-300), Now.AddMinutes(-400) }));
            Assert.That(last.Entries.Select(e => e.Pump.StartTime), Is.EqualTo(new[] { Now.AddMinutes(-500) }));
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
            await CreateAsync(_anna, Pump(startMinutesAgo: i * 10 + 5, endMinutesAgo: i * 10));
        }

        var page = (ListPumpsResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task A_malformed_cursor_is_refused() =>
        Assert.That(await _service.ListAsync(_lea.Id, "not a cursor", null), Is.TypeOf<ListPumpsResult.InvalidCursor>());

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.TypeOf<ListPumpsResult.BabyNotFound>());
}
