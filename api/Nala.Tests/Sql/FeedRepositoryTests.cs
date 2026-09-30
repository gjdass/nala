using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.Feeds;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class FeedRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

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

    private async Task<Feed> AddAsync(
        Baby? baby = null, DateTimeOffset? startTime = null, MilkType milkType = MilkType.Formula, int amountMl = 120, Guid? id = null, User? by = null)
    {
        var feed = new Feed
        {
            Id = id ?? Guid.NewGuid(),
            BabyId = (baby ?? _lea).Id,
            Kind = FeedKind.Bottle,
            StartTime = startTime ?? Now,
            MilkType = milkType,
            AmountMl = amountMl,
            LoggedByUserId = (by ?? _anna).Id,
            UpdatedByUserId = (by ?? _anna).Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = _db();
        await new FeedRepository(db).AddAsync(feed);
        return feed;
    }

    private async Task<Feed> AddSolidsAsync(DateTimeOffset startTime, MealType? mealType = MealType.Lunch, SolidsReaction? reaction = SolidsReaction.Liked)
    {
        var feed = new Feed
        {
            Id = Guid.NewGuid(),
            BabyId = _lea.Id,
            Kind = FeedKind.Solids,
            StartTime = startTime,
            MealType = mealType,
            Food = "Carrot purée",
            Reaction = reaction,
            LoggedByUserId = _anna.Id,
            UpdatedByUserId = _anna.Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = _db();
        await new FeedRepository(db).AddAsync(feed);
        return feed;
    }

    private async Task<IReadOnlyList<FeedEntry>> ListAsync(Baby? baby = null, FeedCursor? after = null, int limit = 50)
    {
        await using var db = _db();
        return await new FeedRepository(db).ListAsync((baby ?? _lea).Id, after, limit);
    }

    [Test]
    public async Task Added_bottle_is_read_back_with_every_field_and_the_names()
    {
        var added = await AddAsync(milkType: MilkType.BreastMilk, amountMl: 90);
        await using (var db = _db())
        {
            var repository = new FeedRepository(db);
            var feed = (await repository.GetAsync(added.Id))!;
            feed.Notes = "sleepy";
            feed.UpdatedByUserId = _ben.Id;
            feed.UpdatedAt = Now.AddMinutes(1);
            await repository.UpdateAsync(feed);
        }

        await using var read = _db();
        var entry = (await new FeedRepository(read).GetEntryAsync(added.Id))!;

        Assert.Multiple(() =>
        {
            Assert.That(entry.Feed.Id, Is.EqualTo(added.Id));
            Assert.That(entry.Feed.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(entry.Feed.Kind, Is.EqualTo(FeedKind.Bottle));
            Assert.That(entry.Feed.StartTime, Is.EqualTo(Now));
            Assert.That(entry.Feed.EndTime, Is.Null);
            Assert.That(entry.Feed.Notes, Is.EqualTo("sleepy"));
            Assert.That(entry.Feed.MilkType, Is.EqualTo(MilkType.BreastMilk));
            Assert.That(entry.Feed.AmountMl, Is.EqualTo(90));
            Assert.That(entry.Feed.CreatedAt, Is.EqualTo(Now));
            Assert.That(entry.Feed.UpdatedAt, Is.EqualTo(Now.AddMinutes(1)));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
        });
    }

    [Test]
    public async Task Added_solids_are_read_back_with_every_field()
    {
        var added = await AddSolidsAsync(startTime: Now, mealType: MealType.Breakfast, reaction: SolidsReaction.Disliked);

        await using var read = _db();
        var feed = (await new FeedRepository(read).GetEntryAsync(added.Id))!.Feed;

        Assert.Multiple(() =>
        {
            Assert.That(feed.Kind, Is.EqualTo(FeedKind.Solids));
            Assert.That(feed.MealType, Is.EqualTo(MealType.Breakfast));
            Assert.That(feed.Food, Is.EqualTo("Carrot purée"));
            Assert.That(feed.Reaction, Is.EqualTo(SolidsReaction.Disliked));
            Assert.That(feed.MilkType, Is.Null);
            Assert.That(feed.AmountMl, Is.Null);
        });
    }

    [Test]
    public async Task Solids_without_meal_type_or_reaction_are_read_back()
    {
        var added = await AddSolidsAsync(startTime: Now, mealType: null, reaction: null);

        await using var read = _db();
        var feed = (await new FeedRepository(read).GetAsync(added.Id))!;

        Assert.That(feed.MealType, Is.Null);
        Assert.That(feed.Reaction, Is.Null);
    }

    [Test]
    public async Task Unknown_feed_is_null()
    {
        await using var db = _db();
        var repository = new FeedRepository(db);

        Assert.That(await repository.GetAsync(Guid.NewGuid()), Is.Null);
        Assert.That(await repository.GetEntryAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task List_is_newest_first_and_only_for_that_baby()
    {
        var older = await AddAsync(startTime: Now.AddHours(-2));
        var newer = await AddAsync(startTime: Now.AddHours(-1));
        await AddAsync(_tom);

        var list = await ListAsync();

        Assert.That(list.Select(e => e.Feed.Id), Is.EqualTo(new[] { newer.Id, older.Id }));
    }

    [Test]
    public async Task Pages_continue_after_the_cursor_even_when_start_times_tie()
    {
        for (var i = 0; i < 5; i++)
        {
            await AddAsync(startTime: Now);
        }

        await AddAsync(startTime: Now.AddHours(-1));
        var all = await ListAsync();

        var first = await ListAsync(limit: 2);
        var second = await ListAsync(after: new FeedCursor(first[^1].Feed.StartTime, first[^1].Feed.Id), limit: 2);
        var rest = await ListAsync(after: new FeedCursor(second[^1].Feed.StartTime, second[^1].Feed.Id));

        Assert.That(
            first.Concat(second).Concat(rest).Select(e => e.Feed.Id),
            Is.EqualTo(all.Select(e => e.Feed.Id)));
        Assert.That(all, Has.Count.EqualTo(6));
    }

    [Test]
    public async Task Deleting_the_baby_deletes_its_feeds()
    {
        var kept = await AddAsync(_tom);
        await AddAsync();
        await using (var db = _db())
        {
            var babies = new BabyRepository(db);
            await babies.DeleteAsync((await babies.GetAsync(_lea.Id))!);
        }

        await using var read = _db();
        var repository = new FeedRepository(read);
        Assert.That(await ListAsync(_lea), Is.Empty);
        Assert.That(await repository.GetAsync(kept.Id), Is.Not.Null);
    }

    [Test]
    public async Task Feeds_of_a_deleted_account_keep_its_display_name()
    {
        var added = await AddAsync(by: _ben);
        await using (var db = _db())
        {
            var users = new UserRepository(db);
            var ben = (await users.GetByIdAsync(_ben.Id))!;
            ben.Email = null;
            ben.PasswordHash = null;
            ben.DeletedAt = Now;
            await users.UpdateAsync(ben);
        }

        var entry = (await ListAsync()).Single();

        Assert.That(entry.Feed.Id, Is.EqualTo(added.Id));
        Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
    }

    [Test]
    public async Task Delete_removes_only_that_feed()
    {
        var removed = await AddAsync();
        var kept = await AddAsync();
        await using (var db = _db())
        {
            var repository = new FeedRepository(db);
            await repository.DeleteAsync((await repository.GetAsync(removed.Id))!);
        }

        Assert.That((await ListAsync()).Select(e => e.Feed.Id), Is.EqualTo(new[] { kept.Id }));
    }

    [Test]
    public async Task Bottle_defaults_come_from_that_baby_latest_bottles()
    {
        await AddAsync(startTime: Now.AddHours(-3), milkType: MilkType.BreastMilk, amountMl: 90);
        await AddAsync(startTime: Now.AddHours(-2), milkType: MilkType.Formula, amountMl: 120);
        await AddAsync(startTime: Now.AddHours(-1), milkType: MilkType.BreastMilk, amountMl: 100);
        await AddAsync(_tom, startTime: Now, milkType: MilkType.Formula, amountMl: 60);

        await using var db = _db();
        var defaults = await new FeedRepository(db).GetBottleDefaultsAsync(_lea.Id);

        Assert.That(defaults, Is.EqualTo(new BottleDefaults(MilkType.BreastMilk, 100, 120)));
    }

    [Test]
    public async Task Bottle_defaults_ignore_solids()
    {
        await AddAsync(startTime: Now.AddHours(-1), milkType: MilkType.Formula, amountMl: 120);
        await AddSolidsAsync(Now);

        await using var db = _db();

        Assert.That(await new FeedRepository(db).GetBottleDefaultsAsync(_lea.Id), Is.EqualTo(new BottleDefaults(MilkType.Formula, null, 120)));
    }

    [Test]
    public async Task Bottle_defaults_are_empty_without_a_bottle()
    {
        await using var db = _db();

        Assert.That(await new FeedRepository(db).GetBottleDefaultsAsync(_lea.Id), Is.EqualTo(new BottleDefaults(null, null, null)));
    }
}
