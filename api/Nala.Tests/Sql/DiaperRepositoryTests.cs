using Nala.Core.Babies;
using Nala.Core.Diapers;
using Nala.Core.Entries;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.Diapers;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class DiaperRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

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

    private async Task<Diaper> AddAsync(Baby? baby = null, DateTimeOffset? time = null, User? by = null)
    {
        var diaper = new Diaper
        {
            Id = Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            Time = time ?? Now.AddHours(-1),
            Wet = true,
            LoggedByUserId = (by ?? _anna).Id,
            UpdatedByUserId = (by ?? _anna).Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = _db();
        await new DiaperRepository(db).AddAsync(diaper);
        return diaper;
    }

    private async Task<IReadOnlyList<DiaperEntry>> ListAsync(Baby? baby = null, EntryCursor? after = null, int limit = 50)
    {
        await using var db = _db();
        return await new DiaperRepository(db).ListAsync((baby ?? _lea).Id, after, limit);
    }

    [Test]
    public async Task Added_diaper_is_read_back_with_every_field_and_the_names()
    {
        var added = await AddAsync(time: Now.AddHours(-2));
        await using (var db = _db())
        {
            var repository = new DiaperRepository(db);
            var diaper = (await repository.GetAsync(added.Id))!;
            diaper.Wet = false;
            diaper.Dirty = true;
            diaper.Rash = true;
            diaper.Color = DiaperColor.Yellow;
            diaper.Consistency = DiaperConsistency.Soft;
            diaper.Notes = "after the bath";
            diaper.UpdatedByUserId = _ben.Id;
            diaper.UpdatedAt = Now.AddMinutes(1);
            await repository.UpdateAsync(diaper);
        }

        await using var read = _db();
        var entry = (await new DiaperRepository(read).GetEntryAsync(added.Id))!;
        Assert.Multiple(() =>
        {
            Assert.That(entry.Diaper.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(entry.Diaper.Time, Is.EqualTo(Now.AddHours(-2)));
            Assert.That(entry.Diaper.Wet, Is.False);
            Assert.That(entry.Diaper.Dirty, Is.True);
            Assert.That(entry.Diaper.Rash, Is.True);
            Assert.That(entry.Diaper.Color, Is.EqualTo(DiaperColor.Yellow));
            Assert.That(entry.Diaper.Consistency, Is.EqualTo(DiaperConsistency.Soft));
            Assert.That(entry.Diaper.Notes, Is.EqualTo("after the bath"));
            Assert.That(entry.Diaper.CreatedAt, Is.EqualTo(Now));
            Assert.That(entry.Diaper.UpdatedAt, Is.EqualTo(Now.AddMinutes(1)));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
        });
    }

    [Test]
    public async Task Unknown_diaper_is_null()
    {
        await using var db = _db();
        var repository = new DiaperRepository(db);

        Assert.That(await repository.GetAsync(Guid.NewGuid()), Is.Null);
        Assert.That(await repository.GetEntryAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task List_is_newest_first_and_only_for_that_baby()
    {
        var older = await AddAsync(time: Now.AddHours(-5));
        var newer = await AddAsync(time: Now.AddHours(-2));
        await AddAsync(_tom);

        var list = await ListAsync();

        Assert.That(list.Select(e => e.Diaper.Id), Is.EqualTo(new[] { newer.Id, older.Id }));
    }

    [Test]
    public async Task Pages_continue_after_the_cursor_even_when_times_tie()
    {
        for (var i = 0; i < 5; i++)
        {
            await AddAsync(time: Now.AddHours(-1));
        }

        await AddAsync(time: Now.AddHours(-3));
        var all = await ListAsync();

        var first = await ListAsync(limit: 2);
        var second = await ListAsync(after: new EntryCursor(first[^1].Diaper.Time, first[^1].Diaper.Id), limit: 2);
        var rest = await ListAsync(after: new EntryCursor(second[^1].Diaper.Time, second[^1].Diaper.Id));

        Assert.That(first.Concat(second).Concat(rest).Select(e => e.Diaper.Id), Is.EqualTo(all.Select(e => e.Diaper.Id)));
        Assert.That(all, Has.Count.EqualTo(6));
    }

    [Test]
    public async Task Deleting_the_baby_deletes_its_diapers()
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
        Assert.That(await new DiaperRepository(read).GetAsync(kept.Id), Is.Not.Null);
    }

    [Test]
    public async Task Diapers_of_a_deleted_account_keep_its_display_name()
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
    public async Task Delete_removes_only_that_diaper()
    {
        var removed = await AddAsync();
        var kept = await AddAsync();
        await using (var db = _db())
        {
            var repository = new DiaperRepository(db);
            await repository.DeleteAsync((await repository.GetAsync(removed.Id))!);
        }

        Assert.That((await ListAsync()).Select(e => e.Diaper.Id), Is.EqualTo(new[] { kept.Id }));
    }
}
