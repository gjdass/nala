using Microsoft.EntityFrameworkCore;
using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.HealthEntries;
using Nala.Core.Sections;
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

    [Test]
    public void Model_has_no_pending_changes()
    {
        var options = new DbContextOptionsBuilder<NalaDbContext>().UseNpgsql("Host=unused").Options;
        using var db = new NalaDbContext(options);

        Assert.That(db.Database.HasPendingModelChanges(), Is.False);
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

    /// <summary>Spec 09 slice 3: Medication is renamed Health; the table and its keys are renamed and every dose is kept.</summary>
    [Test]
    public async Task Medications_table_becomes_health_entries_and_keeps_its_rows()
    {
        var context = await TestDatabase.CreateAsync("20261004141748_AddMedications");
        var (user, baby) = await SeedUserAndBabyAsync(context);
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        await using (var db = context())
        {
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO medications (id, baby_id, time, name, amount, unit, notes, logged_by_user_id, created_at, updated_at, updated_by_user_id)
                VALUES ({first}, {baby.Id}, {Now.AddHours(-2)}, 'Paracetamol', 2.5, 'ml', 'after bath', {user.Id}, {Now}, {Now}, {user.Id}),
                       ({second}, {baby.Id}, {Now.AddHours(-1)}, 'Vitamin D', NULL, NULL, NULL, {user.Id}, {Now}, {Now}, {user.Id})
                """);
            await db.Database.MigrateAsync();
        }

        await using (var db = context())
        {
            var entries = await db.Set<HealthEntry>().OrderBy(e => e.Time).ToListAsync();
            var tables = await db.Database.SqlQuery<string>(
                $"SELECT tablename::text AS \"Value\" FROM pg_tables WHERE tablename IN ('medications', 'health_entries')").ToListAsync();
            var constraints = await db.Database.SqlQuery<string>(
                $"SELECT conname::text AS \"Value\" FROM pg_constraint WHERE conrelid = 'health_entries'::regclass").ToListAsync();
            var indexes = await db.Database.SqlQuery<string>(
                $"SELECT indexname::text AS \"Value\" FROM pg_indexes WHERE tablename = 'health_entries'").ToListAsync();

            Assert.Multiple(() =>
            {
                Assert.That(entries.Select(e => e.Id), Is.EqualTo(new[] { first, second }));
                Assert.That(entries[0].Name, Is.EqualTo("Paracetamol"));
                Assert.That(entries[0].Amount, Is.EqualTo(2.5m));
                Assert.That(entries[0].Unit, Is.EqualTo(DoseUnit.Ml));
                Assert.That(entries[0].Notes, Is.EqualTo("after bath"));
                Assert.That(entries[1].Amount, Is.Null);
                Assert.That(tables, Is.EqualTo(new[] { "health_entries" }));
                Assert.That(constraints, Has.None.Contain("medications"));
                Assert.That(constraints, Is.SupersetOf(new[]
                {
                    "FK_health_entries_babies_baby_id",
                    "FK_health_entries_users_logged_by_user_id",
                    "FK_health_entries_users_updated_by_user_id",
                    "PK_health_entries",
                }));
                Assert.That(indexes, Is.EquivalentTo(new[]
                {
                    "IX_health_entries_logged_by_user_id",
                    "IX_health_entries_updated_by_user_id",
                    "PK_health_entries",
                    "ix_health_entries_baby_id_time_id",
                }));
            });
        }
    }

    /// <summary>Spec 09 slice 3: a user who moved or hid Medication keeps that for Health.</summary>
    [Test]
    public async Task Medication_section_preferences_become_health()
    {
        var context = await TestDatabase.CreateAsync("20261004141748_AddMedications");
        var (anna, _) = await SeedUserAndBabyAsync(context);
        var ben = await SeedUserAsync(context, "ben@mail.com", "Ben");
        await using (var db = context())
        {
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO user_section_preferences (user_id, key, position, visible)
                VALUES ({anna.Id}, 'feed', 0, true), ({anna.Id}, 'medication', 2, false), ({ben.Id}, 'medication', 5, true)
                """);
            await db.Database.MigrateAsync();
        }

        await using (var db = context())
        {
            var rows = await db.Set<SectionPreference>()
                .OrderBy(p => p.UserId == anna.Id ? 0 : 1).ThenBy(p => p.Position)
                .Select(p => new { p.UserId, p.Key, p.Position, p.Visible })
                .ToListAsync();

            Assert.That(rows, Is.EqualTo(new[]
            {
                new { UserId = anna.Id, Key = "feed", Position = 0, Visible = true },
                new { UserId = anna.Id, Key = "health", Position = 2, Visible = false },
                new { UserId = ben.Id, Key = "health", Position = 5, Visible = true },
            }));
        }
    }

    private static async Task<User> SeedUserAsync(Func<NalaDbContext> context, string email, string displayName)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = displayName,
            PasswordHash = "hash",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        await using var db = context();
        await new UserRepository(db).AddAsync(user);
        return user;
    }

    private static async Task<(User User, Baby Baby)> SeedUserAndBabyAsync(Func<NalaDbContext> context)
    {
        var user = await SeedUserAsync(context, "anna@mail.com", "Anna");
        var baby = new Baby
        {
            Id = Guid.NewGuid(),
            Name = "Lea",
            BirthDate = new DateOnly(2026, 9, 1),
            CreatedByUserId = user.Id,
            CreatedAt = Now,
            UpdatedAt = Now,
        };
        await using var db = context();
        await new BabyRepository(db).AddAsync(baby);
        return (user, baby);
    }
}
