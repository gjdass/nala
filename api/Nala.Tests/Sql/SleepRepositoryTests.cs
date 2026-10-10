using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Sleeps;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.Sleeps;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class SleepRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
    private Guid _familyId;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;
    private Baby _tom = null!;

    [SetUp]
    public async Task SetUp()
    {
        _db = await TestDatabase.CreateAsync();
        _anna = NewUser("anna", "Anna");
        _ben = NewUser("ben", "Ben");
        await using var db = _db();
        var users = new UserRepository(db);
        await users.AddAsync(_anna);
        await users.AddAsync(_ben);
        _familyId = (await TestFamilies.SeedAsync(db, _anna, _ben)).Id;
        _lea = NewBaby("Lea");
        _tom = NewBaby("Tom");
        var babies = new BabyRepository(db);
        await babies.AddAsync(_lea);
        await babies.AddAsync(_tom);
    }

    private static User NewUser(string email, string name) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{email}@mail.com",
        DisplayName = name,
        PasswordHash = "hash",
        PreferredLanguage = "en",
        CreatedAt = Now,
    };

    private Baby NewBaby(string name) => new()
    {
        Id = Guid.NewGuid(),
        FamilyId = _familyId,
        Name = name,
        BirthDate = new DateOnly(2026, 9, 1),
        CreatedByUserId = _anna.Id,
        CreatedAt = Now,
        UpdatedAt = Now,
    };

    private async Task<Sleep> AddAsync(Baby? baby = null, DateTimeOffset? startTime = null, DateTimeOffset? endTime = null, User? by = null, string? notes = null, bool live = false)
    {
        var start = startTime ?? Now.AddHours(-1);
        var sleep = new Sleep
        {
            Id = Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            StartTime = start,
            EndTime = live ? null : endTime ?? start.AddMinutes(45),
            Notes = notes,
            LoggedByUserId = (by ?? _anna).Id,
            UpdatedByUserId = (by ?? _anna).Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = _db();
        await new SleepRepository(db).AddAsync(sleep);
        return sleep;
    }

    private async Task<IReadOnlyList<SleepEntry>> ListAsync(Baby? baby = null, EntryCursor? after = null, int limit = 50)
    {
        await using var db = _db();
        return await new SleepRepository(db).ListAsync((baby ?? _lea).Id, after, limit);
    }

    [Test]
    public async Task Added_sleep_is_read_back_with_every_field_and_the_names()
    {
        var added = await AddAsync(startTime: Now.AddHours(-2), endTime: Now.AddHours(-1));
        await using (var db = _db())
        {
            var repository = new SleepRepository(db);
            var sleep = (await repository.GetAsync(added.Id))!;
            sleep.Notes = "stroller";
            sleep.UpdatedByUserId = _ben.Id;
            sleep.UpdatedAt = Now.AddMinutes(1);
            await repository.UpdateAsync(sleep);
        }

        await using var read = _db();
        var entry = (await new SleepRepository(read).GetEntryAsync(added.Id))!;
        Assert.Multiple(() =>
        {
            Assert.That(entry.Sleep.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(entry.Sleep.StartTime, Is.EqualTo(Now.AddHours(-2)));
            Assert.That(entry.Sleep.EndTime, Is.EqualTo(Now.AddHours(-1)));
            Assert.That(entry.Sleep.Notes, Is.EqualTo("stroller"));
            Assert.That(entry.Sleep.CreatedAt, Is.EqualTo(Now));
            Assert.That(entry.Sleep.UpdatedAt, Is.EqualTo(Now.AddMinutes(1)));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
        });
    }

    [Test]
    public async Task Unknown_sleep_is_null()
    {
        await using var db = _db();
        var repository = new SleepRepository(db);

        Assert.That(await repository.GetAsync(Guid.NewGuid()), Is.Null);
        Assert.That(await repository.GetEntryAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task List_is_newest_first_and_only_for_that_baby()
    {
        var older = await AddAsync(startTime: Now.AddHours(-5));
        var newer = await AddAsync(startTime: Now.AddHours(-2));
        await AddAsync(_tom);

        var list = await ListAsync();

        Assert.That(list.Select(e => e.Sleep.Id), Is.EqualTo(new[] { newer.Id, older.Id }));
    }

    [Test]
    public async Task Pages_continue_after_the_cursor_even_when_start_times_tie()
    {
        for (var i = 0; i < 5; i++)
        {
            await AddAsync(startTime: Now.AddHours(-1));
        }

        await AddAsync(startTime: Now.AddHours(-3));
        var all = await ListAsync();

        var first = await ListAsync(limit: 2);
        var second = await ListAsync(after: new EntryCursor(first[^1].Sleep.StartTime, first[^1].Sleep.Id), limit: 2);
        var rest = await ListAsync(after: new EntryCursor(second[^1].Sleep.StartTime, second[^1].Sleep.Id));

        Assert.That(first.Concat(second).Concat(rest).Select(e => e.Sleep.Id), Is.EqualTo(all.Select(e => e.Sleep.Id)));
        Assert.That(all, Has.Count.EqualTo(6));
    }

    [Test]
    public async Task Deleting_the_baby_deletes_its_sleeps()
    {
        var kept = await AddAsync(_tom);
        await AddAsync();
        await using (var db = _db())
        {
            var babies = new BabyRepository(db);
            await babies.DeleteAsync((await babies.GetAsync(_lea.Id))!);
        }

        await using var read = _db();
        Assert.That(await ListAsync(_lea), Is.Empty);
        Assert.That(await new SleepRepository(read).GetAsync(kept.Id), Is.Not.Null);
    }

    [Test]
    public async Task Sleeps_of_a_deleted_account_keep_its_display_name()
    {
        await AddAsync(by: _ben);
        await using (var db = _db())
        {
            var users = new UserRepository(db);
            var ben = (await users.GetByIdAsync(_ben.Id))!;
            ben.Email = null;
            ben.PasswordHash = null;
            ben.DeletedAt = Now;
            await users.UpdateAsync(ben);
        }

        Assert.That((await ListAsync()).Single().LoggedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
    }

    [Test]
    public async Task Delete_removes_only_that_sleep()
    {
        var removed = await AddAsync();
        var kept = await AddAsync();
        await using (var db = _db())
        {
            var repository = new SleepRepository(db);
            await repository.DeleteAsync((await repository.GetAsync(removed.Id))!);
        }

        Assert.That((await ListAsync()).Select(e => e.Sleep.Id), Is.EqualTo(new[] { kept.Id }));
    }

    [Test]
    public async Task The_live_sleep_of_a_baby_is_its_oldest_one_without_an_end()
    {
        await AddAsync(startTime: Now.AddHours(-3));
        await AddAsync(_tom, startTime: Now.AddHours(-4), live: true);
        var newer = await AddAsync(startTime: Now.AddMinutes(-10), live: true);
        var older = await AddAsync(startTime: Now.AddMinutes(-40), live: true, by: _ben);

        await using var db = _db();
        var repository = new SleepRepository(db);
        var live = (await repository.GetLiveAsync(_lea.Id))!;
        var none = await repository.GetLiveAsync(Guid.NewGuid());

        Assert.Multiple(() =>
        {
            Assert.That(live.Sleep.Id, Is.EqualTo(older.Id));
            Assert.That(live.LoggedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(newer.EndTime, Is.Null);
            Assert.That(none, Is.Null);
        });
    }

    [Test]
    public async Task Live_sleeps_of_every_baby_are_listed_oldest_start_first()
    {
        await AddAsync(startTime: Now.AddHours(-5));
        var lea = await AddAsync(startTime: Now.AddMinutes(-10), live: true);
        var tom = await AddAsync(_tom, startTime: Now.AddMinutes(-50), live: true);

        await using var db = _db();
        var live = await new SleepRepository(db).ListLiveAsync();

        Assert.Multiple(() =>
        {
            Assert.That(live.Select(e => e.Sleep.Id), Is.EqualTo(new[] { tom.Id, lea.Id }));
            Assert.That(live.Select(e => e.LoggedBy.DisplayName), Is.All.EqualTo("Anna"));
        });
    }
}
