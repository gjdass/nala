using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class FeedServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    private FakeFeedRepository _feeds = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private FeedService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _feeds = new FakeFeedRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new FeedService(_feeds, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _feeds.Names[user.Id] = name;
        return user;
    }

    private static FeedInput Bottle(string milkType = "formula", decimal amountMl = 120, DateTimeOffset? startTime = null, string? notes = null) =>
        new("bottle", startTime ?? Now.AddMinutes(-10), notes, milkType, amountMl);

    private async Task<FeedEntry> CreateAsync(User actor, FeedInput input, Guid? id = null) =>
        ((CreateFeedResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, input)).Entry;

    [Test]
    public async Task Creating_a_bottle_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, Bottle("breastMilk", 90, notes: " sleepy "), id);

        var feed = _feeds.Feeds.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.Feed, Is.SameAs(feed));
            Assert.That(feed.Id, Is.EqualTo(id));
            Assert.That(feed.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(feed.Kind, Is.EqualTo(FeedKind.Bottle));
            Assert.That(feed.StartTime, Is.EqualTo(Now.AddMinutes(-10)));
            Assert.That(feed.EndTime, Is.Null);
            Assert.That(feed.Notes, Is.EqualTo("sleepy"));
            Assert.That(feed.MilkType, Is.EqualTo(MilkType.BreastMilk));
            Assert.That(feed.AmountMl, Is.EqualTo(90));
            Assert.That(feed.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(feed.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(feed.CreatedAt, Is.EqualTo(Now));
            Assert.That(feed.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Bottle());

        Assert.That(result, Is.InstanceOf<CreateFeedResult.BabyNotFound>());
        Assert.That(_feeds.Feeds, Is.Empty);
    }

    [Test]
    public async Task Invalid_input_saves_nothing()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Bottle(amountMl: 0));

        Assert.That(((CreateFeedResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["amountMl"] = "outOfRange" }));
        Assert.That(_feeds.Feeds, Is.Empty);
    }

    [Test]
    public async Task Resending_a_feed_with_the_same_id_returns_the_stored_one_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, Bottle(amountMl: 90), id);
        _time.Now = Now.AddMinutes(5);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, Bottle(amountMl: 150));

        var entry = ((CreateFeedResult.AlreadyExists)result).Entry;
        Assert.That(_feeds.Feeds, Has.Count.EqualTo(1));
        Assert.That(entry.Feed.AmountMl, Is.EqualTo(90));
        Assert.That(entry.Feed.UpdatedByUserId, Is.EqualTo(_anna.Id));
        Assert.That(entry.Feed.UpdatedAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Any_member_can_edit_a_feed_and_the_edit_records_who_and_when()
    {
        var created = await CreateAsync(_anna, Bottle(amountMl: 90));
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.Feed.Id, Bottle("breastMilk", 110, Now.AddMinutes(-20), "more"));

        var entry = ((UpdateFeedResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(entry.Feed.AmountMl, Is.EqualTo(110));
            Assert.That(entry.Feed.MilkType, Is.EqualTo(MilkType.BreastMilk));
            Assert.That(entry.Feed.StartTime, Is.EqualTo(Now.AddMinutes(-20)));
            Assert.That(entry.Feed.Notes, Is.EqualTo("more"));
            Assert.That(entry.Feed.UpdatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(entry.Feed.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
            Assert.That(entry.Feed.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(entry.Feed.CreatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy.DisplayName, Is.EqualTo("Anna"));
            Assert.That(entry.UpdatedBy.DisplayName, Is.EqualTo("Ben"));
        });
    }

    [Test]
    public async Task Editing_keeps_the_kind_whatever_the_client_sends()
    {
        var created = await CreateAsync(_anna, Bottle());

        var result = await _service.UpdateAsync(_ben, created.Feed.Id, Bottle() with { Kind = null });

        Assert.That(result, Is.InstanceOf<UpdateFeedResult.Updated>());
        Assert.That(created.Feed.Kind, Is.EqualTo(FeedKind.Bottle));
    }

    [Test]
    public async Task Invalid_edit_changes_nothing()
    {
        var created = await CreateAsync(_anna, Bottle(amountMl: 90));

        var result = await _service.UpdateAsync(_ben, created.Feed.Id, Bottle(amountMl: 501));

        Assert.That(((UpdateFeedResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["amountMl"] = "outOfRange" }));
        Assert.That(created.Feed.AmountMl, Is.EqualTo(90));
        Assert.That(created.Feed.UpdatedByUserId, Is.EqualTo(_anna.Id));
    }

    [Test]
    public async Task Editing_an_unknown_feed_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_ben, Guid.NewGuid(), Bottle()), Is.InstanceOf<UpdateFeedResult.NotFound>());

    [Test]
    public async Task Any_member_can_delete_a_feed()
    {
        var created = await CreateAsync(_anna, Bottle());

        Assert.That(await _service.DeleteAsync(created.Feed.Id), Is.InstanceOf<DeleteFeedResult.Deleted>());
        Assert.That(_feeds.Feeds, Is.Empty);
    }

    [Test]
    public async Task Deleting_an_unknown_feed_is_not_found() =>
        Assert.That(await _service.DeleteAsync(Guid.NewGuid()), Is.InstanceOf<DeleteFeedResult.NotFound>());

    [Test]
    public async Task Listing_pages_newest_first_with_a_cursor()
    {
        for (var i = 0; i < 5; i++)
        {
            await CreateAsync(_anna, Bottle(startTime: Now.AddHours(-i)));
        }

        var first = (ListFeedsResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListFeedsResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);
        var last = (ListFeedsResult.Page)await _service.ListAsync(_lea.Id, second.Next, 2);

        Assert.That(first.Entries.Select(e => e.Feed.StartTime), Is.EqualTo(new[] { Now, Now.AddHours(-1) }));
        Assert.That(second.Entries.Select(e => e.Feed.StartTime), Is.EqualTo(new[] { Now.AddHours(-2), Now.AddHours(-3) }));
        Assert.That(last.Entries.Select(e => e.Feed.StartTime), Is.EqualTo(new[] { Now.AddHours(-4) }));
        Assert.That(first.Next, Is.Not.Null);
        Assert.That(last.Next, Is.Null);
    }

    [Test]
    public async Task An_exactly_full_last_page_has_no_next()
    {
        await CreateAsync(_anna, Bottle());
        await CreateAsync(_anna, Bottle());

        var page = (ListFeedsResult.Page)await _service.ListAsync(_lea.Id, null, 2);

        Assert.That(page.Entries, Has.Count.EqualTo(2));
        Assert.That(page.Next, Is.Null);
    }

    [TestCase(null, FeedService.DefaultPageSize)]
    [TestCase(0, 1)]
    [TestCase(500, FeedService.MaxPageSize)]
    public async Task Page_size_defaults_to_20_and_stays_within_1_to_50(int? limit, int expected)
    {
        for (var i = 0; i < 60; i++)
        {
            await CreateAsync(_anna, Bottle(startTime: Now.AddMinutes(-i)));
        }

        var page = (ListFeedsResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.InstanceOf<ListFeedsResult.BabyNotFound>());

    [TestCase("garbage")]
    [TestCase("")]
    public async Task A_malformed_cursor_is_refused(string cursor) =>
        Assert.That(await _service.ListAsync(_lea.Id, cursor, null), Is.InstanceOf<ListFeedsResult.InvalidCursor>());

    [Test]
    public void A_cursor_round_trips()
    {
        var cursor = new FeedCursor(Now, Guid.NewGuid());

        Assert.That(FeedCursor.TryDecode(cursor.Encode()), Is.EqualTo(cursor));
    }

    [Test]
    public async Task Bottle_defaults_come_from_the_latest_bottle_and_the_last_amount_per_milk_type()
    {
        await CreateAsync(_anna, Bottle("breastMilk", 90, Now.AddHours(-3)));
        await CreateAsync(_anna, Bottle("formula", 120, Now.AddHours(-2)));
        await CreateAsync(_anna, Bottle("breastMilk", 100, Now.AddHours(-1)));

        var result = (BottleDefaultsResult.Found)await _service.GetBottleDefaultsAsync(_lea.Id);

        Assert.That(result.Defaults, Is.EqualTo(new BottleDefaults(MilkType.BreastMilk, 100, 120)));
    }

    [Test]
    public async Task Bottle_defaults_are_empty_without_a_bottle()
    {
        var result = (BottleDefaultsResult.Found)await _service.GetBottleDefaultsAsync(_lea.Id);

        Assert.That(result.Defaults, Is.EqualTo(new BottleDefaults(null, null, null)));
    }

    [Test]
    public async Task Bottle_defaults_of_an_unknown_baby_are_refused() =>
        Assert.That(await _service.GetBottleDefaultsAsync(Guid.NewGuid()), Is.InstanceOf<BottleDefaultsResult.BabyNotFound>());
}
