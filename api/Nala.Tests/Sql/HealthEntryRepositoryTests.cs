using Nala.Core.Babies;
using Nala.Core.HealthEntries;
using Nala.Core.Entries;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.HealthEntries;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class HealthEntryRepositoryTests
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

    private async Task<HealthEntry> AddAsync(
        Baby? baby = null, DateTimeOffset? time = null, User? by = null, string name = "Paracetamol", decimal? amount = null, DoseUnit? unit = null)
    {
        var healthEntry = new HealthEntry
        {
            Id = Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            Time = time ?? Now.AddHours(-1),
            Name = name,
            Amount = amount,
            Unit = unit,
            LoggedByUserId = (by ?? _anna).Id,
            UpdatedByUserId = (by ?? _anna).Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = _db();
        await new HealthEntryRepository(db).AddAsync(healthEntry);
        return healthEntry;
    }

    private async Task<IReadOnlyList<HealthEntryDetails>> ListAsync(Baby? baby = null, EntryCursor? after = null, int limit = 50)
    {
        await using var db = _db();
        return await new HealthEntryRepository(db).ListAsync((baby ?? _lea).Id, after, limit);
    }

    [Test]
    public async Task Added_health_entry_is_read_back_with_every_field_and_the_names()
    {
        var added = await AddAsync(time: Now.AddHours(-2));
        await using (var db = _db())
        {
            var repository = new HealthEntryRepository(db);
            var healthEntry = (await repository.GetAsync(added.Id))!;
            healthEntry.Name = "Vitamin D";
            healthEntry.Amount = 2.5m;
            healthEntry.Unit = DoseUnit.Drops;
            healthEntry.Notes = "morning";
            healthEntry.UpdatedByUserId = _ben.Id;
            healthEntry.UpdatedAt = Now.AddMinutes(1);
            await repository.UpdateAsync(healthEntry);
        }

        await using var read = _db();
        var entry = (await new HealthEntryRepository(read).GetEntryAsync(added.Id))!;
        Assert.Multiple(() =>
        {
            Assert.That(entry.HealthEntry.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(entry.HealthEntry.Time, Is.EqualTo(Now.AddHours(-2)));
            Assert.That(entry.HealthEntry.Name, Is.EqualTo("Vitamin D"));
            Assert.That(entry.HealthEntry.Amount, Is.EqualTo(2.5m));
            Assert.That(entry.HealthEntry.Unit, Is.EqualTo(DoseUnit.Drops));
            Assert.That(entry.HealthEntry.Notes, Is.EqualTo("morning"));
            Assert.That(entry.HealthEntry.CreatedAt, Is.EqualTo(Now));
            Assert.That(entry.HealthEntry.UpdatedAt, Is.EqualTo(Now.AddMinutes(1)));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
        });
    }

    [Test]
    public async Task Unknown_health_entry_is_null()
    {
        await using var db = _db();
        var repository = new HealthEntryRepository(db);

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

        Assert.That(list.Select(e => e.HealthEntry.Id), Is.EqualTo(new[] { newer.Id, older.Id }));
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
        var second = await ListAsync(after: new EntryCursor(first[^1].HealthEntry.Time, first[^1].HealthEntry.Id), limit: 2);
        var rest = await ListAsync(after: new EntryCursor(second[^1].HealthEntry.Time, second[^1].HealthEntry.Id));

        Assert.That(first.Concat(second).Concat(rest).Select(e => e.HealthEntry.Id), Is.EqualTo(all.Select(e => e.HealthEntry.Id)));
        Assert.That(all, Has.Count.EqualTo(6));
    }

    [Test]
    public async Task Deleting_the_baby_deletes_its_health_entries()
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
        Assert.That(await new HealthEntryRepository(read).GetAsync(kept.Id), Is.Not.Null);
    }

    [Test]
    public async Task Health_entries_of_a_deleted_account_keep_its_display_name()
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
    public async Task Delete_removes_only_that_health_entry()
    {
        var removed = await AddAsync();
        var kept = await AddAsync();
        await using (var db = _db())
        {
            var repository = new HealthEntryRepository(db);
            await repository.DeleteAsync((await repository.GetAsync(removed.Id))!);
        }

        Assert.That((await ListAsync()).Select(e => e.HealthEntry.Id), Is.EqualTo(new[] { kept.Id }));
    }

    private async Task<IReadOnlyList<RecentMedicine>> RecentAsync(Baby? baby = null, int limit = 5)
    {
        await using var db = _db();
        return await new HealthEntryRepository(db).ListRecentAsync((baby ?? _lea).Id, limit);
    }

    [Test]
    public async Task Recent_names_are_distinct_whatever_the_case_with_the_latest_spelling_and_dose()
    {
        await AddAsync(time: Now.AddHours(-5), name: "paracetamol", amount: 5m, unit: DoseUnit.Mg);
        await AddAsync(time: Now.AddHours(-2), name: "Paracetamol", amount: 2.5m, unit: DoseUnit.Ml);
        await AddAsync(time: Now.AddHours(-3), name: "PARACETAMOL", amount: 1m, unit: DoseUnit.Dose);

        Assert.That(await RecentAsync(), Is.EqualTo(new[] { new RecentMedicine("Paracetamol", 2.5m, DoseUnit.Ml) }));
    }

    [Test]
    public async Task Recent_names_are_most_recent_first_up_to_the_limit()
    {
        for (var i = 1; i <= 7; i++)
        {
            await AddAsync(time: Now.AddHours(-i), name: $"Medicine {i}");
        }

        Assert.That((await RecentAsync()).Select(r => r.Name), Is.EqualTo(new[] { "Medicine 1", "Medicine 2", "Medicine 3", "Medicine 4", "Medicine 5" }));
    }

    [Test]
    public async Task Recent_names_are_only_of_that_baby()
    {
        await AddAsync(name: "Vitamin D");
        await AddAsync(_tom, name: "Ibuprofen");

        Assert.That((await RecentAsync()).Select(r => r.Name), Is.EqualTo(new[] { "Vitamin D" }));
    }

    [Test]
    public async Task A_recent_name_has_no_dose_when_its_latest_entry_has_none()
    {
        await AddAsync(time: Now.AddHours(-3), name: "Vitamin D", amount: 4m, unit: DoseUnit.Drops);
        await AddAsync(time: Now.AddHours(-1), name: "Vitamin D");

        Assert.That(await RecentAsync(), Is.EqualTo(new[] { new RecentMedicine("Vitamin D", null, null) }));
    }
}
