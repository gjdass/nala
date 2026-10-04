using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.GrowthEntries;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.GrowthEntries;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class GrowthEntryRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
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
        _lea = NewBaby("Lea");
        _tom = NewBaby("Tom");
        await using var db = _db();
        var users = new UserRepository(db);
        await users.AddAsync(_anna);
        await users.AddAsync(_ben);
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
        Name = name,
        BirthDate = new DateOnly(2026, 9, 1),
        CreatedByUserId = _anna.Id,
        CreatedAt = Now,
        UpdatedAt = Now,
    };

    private async Task<GrowthEntry> AddAsync(
        Baby? baby = null,
        int day = 28,
        DateTimeOffset? createdAt = null,
        User? by = null,
        int? weightG = 4250,
        decimal? lengthCm = 55.5m,
        decimal? headCircumferenceCm = 38m,
        string? notes = null)
    {
        var growthEntry = new GrowthEntry
        {
            Id = Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            Kind = GrowthKind.Measurement,
            Date = new DateOnly(2026, 9, day),
            WeightG = weightG,
            LengthCm = lengthCm,
            HeadCircumferenceCm = headCircumferenceCm,
            Notes = notes,
            LoggedByUserId = (by ?? _anna).Id,
            UpdatedByUserId = (by ?? _anna).Id,
            CreatedAt = createdAt ?? Now,
            UpdatedAt = createdAt ?? Now,
        };
        await using var db = _db();
        await new GrowthEntryRepository(db).AddAsync(growthEntry);
        return growthEntry;
    }

    private async Task<IReadOnlyList<GrowthEntryDetails>> ListAsync(Baby? baby = null, GrowthEntryCursor? after = null, int limit = 50)
    {
        await using var db = _db();
        return await new GrowthEntryRepository(db).ListAsync((baby ?? _lea).Id, after, limit);
    }

    private async Task<GrowthLatest> LatestAsync(Baby? baby = null)
    {
        await using var db = _db();
        return await new GrowthEntryRepository(db).LatestAsync((baby ?? _lea).Id);
    }

    private static GrowthEntryCursor CursorOf(GrowthEntryDetails entry) =>
        new(entry.GrowthEntry.Date, entry.GrowthEntry.CreatedAt, entry.GrowthEntry.Id);

    [Test]
    public async Task Added_growth_entry_is_read_back_with_every_field_and_the_names()
    {
        var added = await AddAsync(weightG: 4250, lengthCm: 55.5m, headCircumferenceCm: 38.2m, notes: "doctor");

        await using var db = _db();
        var entry = (await new GrowthEntryRepository(db).GetEntryAsync(added.Id))!;

        Assert.Multiple(() =>
        {
            Assert.That(entry.GrowthEntry.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(entry.GrowthEntry.Kind, Is.EqualTo(GrowthKind.Measurement));
            Assert.That(entry.GrowthEntry.Date, Is.EqualTo(new DateOnly(2026, 9, 28)));
            Assert.That(entry.GrowthEntry.WeightG, Is.EqualTo(4250));
            Assert.That(entry.GrowthEntry.LengthCm, Is.EqualTo(55.5m));
            Assert.That(entry.GrowthEntry.HeadCircumferenceCm, Is.EqualTo(38.2m));
            Assert.That(entry.GrowthEntry.Notes, Is.EqualTo("doctor"));
            Assert.That(entry.GrowthEntry.CreatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task A_measurement_with_missing_values_is_read_back()
    {
        var added = await AddAsync(weightG: null, lengthCm: null, headCircumferenceCm: 37m);

        await using var db = _db();
        var growthEntry = (await new GrowthEntryRepository(db).GetAsync(added.Id))!;

        Assert.That(growthEntry.WeightG, Is.Null);
        Assert.That(growthEntry.LengthCm, Is.Null);
        Assert.That(growthEntry.HeadCircumferenceCm, Is.EqualTo(37m));
    }

    [Test]
    public async Task Unknown_growth_entry_is_null()
    {
        await using var db = _db();
        Assert.That(await new GrowthEntryRepository(db).GetEntryAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task List_is_newest_date_first_then_newest_created_and_only_for_that_baby()
    {
        var older = await AddAsync(day: 10);
        var sameDayFirst = await AddAsync(day: 20, createdAt: Now);
        var sameDaySecond = await AddAsync(day: 20, createdAt: Now.AddMinutes(1));
        await AddAsync(_tom, day: 25);

        var list = await ListAsync();

        Assert.That(list.Select(e => e.GrowthEntry.Id), Is.EqualTo(new[] { sameDaySecond.Id, sameDayFirst.Id, older.Id }));
    }

    [Test]
    public async Task Pages_continue_after_the_cursor_even_when_dates_and_creation_times_tie()
    {
        for (var i = 0; i < 5; i++)
        {
            await AddAsync(day: 20);
        }

        await AddAsync(day: 21, createdAt: Now.AddMinutes(-5));
        await AddAsync(day: 3);
        var all = await ListAsync();

        var first = await ListAsync(limit: 2);
        var second = await ListAsync(after: CursorOf(first[^1]), limit: 2);
        var rest = await ListAsync(after: CursorOf(second[^1]));

        Assert.That(first.Concat(second).Concat(rest).Select(e => e.GrowthEntry.Id), Is.EqualTo(all.Select(e => e.GrowthEntry.Id)));
        Assert.That(all, Has.Count.EqualTo(7));
    }

    [Test]
    public async Task Latest_takes_each_measure_from_the_most_recent_entry_that_has_it()
    {
        await AddAsync(day: 10, weightG: 3800, lengthCm: 52m, headCircumferenceCm: 36m);
        await AddAsync(day: 20, createdAt: Now, weightG: 4000, lengthCm: null, headCircumferenceCm: null);
        await AddAsync(day: 20, createdAt: Now.AddMinutes(1), weightG: 4100, lengthCm: null, headCircumferenceCm: null);
        await AddAsync(day: 15, weightG: null, lengthCm: 53.5m, headCircumferenceCm: null);
        await AddAsync(_tom, day: 30, weightG: 9000, lengthCm: 70m, headCircumferenceCm: 45m);

        var latest = await LatestAsync();

        Assert.That(latest, Is.EqualTo(new GrowthLatest(
            new LatestMeasure(4100m, new DateOnly(2026, 9, 20), false),
            new LatestMeasure(53.5m, new DateOnly(2026, 9, 15), false),
            new LatestMeasure(36m, new DateOnly(2026, 9, 10), false))));
    }

    [Test]
    public async Task Latest_without_entries_is_none() =>
        Assert.That(await LatestAsync(), Is.EqualTo(new GrowthLatest(null, null, null)));

    [Test]
    public async Task Deleting_the_baby_deletes_its_growth_entries()
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
        Assert.That(await new GrowthEntryRepository(read).GetAsync(kept.Id), Is.Not.Null);
    }

    [Test]
    public async Task Growth_entries_of_a_deleted_account_keep_its_display_name()
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
    public async Task Update_saves_the_changes()
    {
        var added = await AddAsync();
        await using (var db = _db())
        {
            var repository = new GrowthEntryRepository(db);
            var growthEntry = (await repository.GetAsync(added.Id))!;
            growthEntry.WeightG = 4400;
            growthEntry.UpdatedByUserId = _ben.Id;
            await repository.UpdateAsync(growthEntry);
        }

        var entry = (await ListAsync()).Single();
        Assert.That(entry.GrowthEntry.WeightG, Is.EqualTo(4400));
        Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
    }

    [Test]
    public async Task Delete_removes_only_that_growth_entry()
    {
        var removed = await AddAsync();
        var kept = await AddAsync();
        await using (var db = _db())
        {
            var repository = new GrowthEntryRepository(db);
            await repository.DeleteAsync((await repository.GetAsync(removed.Id))!);
        }

        Assert.That((await ListAsync()).Select(e => e.GrowthEntry.Id), Is.EqualTo(new[] { kept.Id }));
    }
}
