using Microsoft.EntityFrameworkCore;
using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class MigrationTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 30, 12, 0, 0, TimeSpan.Zero);

    [Test]
    public void Initial_migration_exists()
    {
        var options = new DbContextOptionsBuilder<NalaDbContext>().UseNpgsql("Host=unused").Options;
        using var db = new NalaDbContext(options);

        var migrations = db.Database.GetMigrations().ToArray();

        Assert.That(migrations, Is.Not.Empty);
        Assert.That(migrations[0], Does.EndWith("_InitialCreate"));
    }

    /// <summary>Spec 05 slice 8: a breastfeed paused before "live or not" becomes an ordinary feed.</summary>
    [Test]
    public async Task Paused_breastfeeds_get_their_end_time_from_their_last_segment()
    {
        var context = await TestDatabase.CreateAsync("20260930161049_AddBreastfeedSegments");
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "anna@mail.com",
            DisplayName = "Anna",
            PasswordHash = "hash",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        var baby = new Baby
        {
            Id = Guid.NewGuid(),
            Name = "Lea",
            BirthDate = new DateOnly(2026, 9, 1),
            CreatedByUserId = user.Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using (var db = context())
        {
            await new UserRepository(db).AddAsync(user);
            await new BabyRepository(db).AddAsync(baby);
        }

        Feed Breastfeed(int startMinutesAgo, int? endMinutesAgo, params (BreastSide Side, int From, int? To)[] segments)
        {
            var id = Guid.NewGuid();
            var start = Now.AddMinutes(-startMinutesAgo);
            return new Feed
            {
                Id = id,
                BabyId = baby.Id,
                Kind = FeedKind.Breastfeed,
                StartTime = start,
                EndTime = endMinutesAgo is { } end ? Now.AddMinutes(-end) : null,
                LoggedByUserId = user.Id,
                UpdatedByUserId = user.Id,
                CreatedAt = Now,
                UpdatedAt = Now,
                Segments = segments.Select(s => new BreastFeedSegment
                {
                    Id = Guid.NewGuid(),
                    FeedId = id,
                    Side = s.Side,
                    StartedAt = start.AddMinutes(s.From),
                    EndedAt = s.To is { } to ? start.AddMinutes(to) : null,
                }).ToList(),
            };
        }

        var paused = Breastfeed(60, null, (BreastSide.Left, 0, 5), (BreastSide.Right, 5, 12));
        var empty = Breastfeed(50, null);
        var live = Breastfeed(10, null, (BreastSide.Left, 0, null));
        var saved = Breastfeed(120, 100, (BreastSide.Left, 0, 20));
        await using (var db = context())
        {
            db.AddRange(paused, empty, live, saved);
            await db.SaveChangesAsync();
        }

        await using (var db = context())
        {
            await db.Database.MigrateAsync();
        }

        await using (var db = context())
        {
            var ends = await db.Set<Feed>().ToDictionaryAsync(f => f.Id, f => f.EndTime);
            Assert.Multiple(() =>
            {
                Assert.That(ends[paused.Id], Is.EqualTo(Now.AddMinutes(-48)));
                Assert.That(ends[empty.Id], Is.EqualTo(Now.AddMinutes(-50)));
                Assert.That(ends[live.Id], Is.Null);
                Assert.That(ends[saved.Id], Is.EqualTo(Now.AddMinutes(-100)));
            });
        }
    }
}
