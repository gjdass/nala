using Nala.Core.Babies;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Babies;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class BabyRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
    private User _anna = null!;
    private Guid _familyId;

    [SetUp]
    public async Task SetUp()
    {
        _db = await TestDatabase.CreateAsync();
        _anna = new User
        {
            Id = Guid.NewGuid(),
            Email = "anna@mail.com",
            DisplayName = "Anna",
            PasswordHash = "hash",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        await using var db = _db();
        await new UserRepository(db).AddAsync(_anna);
        _familyId = (await TestFamilies.SeedAsync(db, _anna)).Id;
    }

    private async Task<Baby> AddAsync(string name, DateOnly birthDate, DateTimeOffset? createdAt = null, Action<Baby>? change = null, Guid? familyId = null)
    {
        var baby = new Baby
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId ?? _familyId,
            Name = name,
            BirthDate = birthDate,
            CreatedByUserId = _anna.Id,
            CreatedAt = createdAt ?? Now,
            UpdatedAt = createdAt ?? Now,
        };
        change?.Invoke(baby);
        await using var db = _db();
        await new BabyRepository(db).AddAsync(baby);
        return baby;
    }

    private async Task<IReadOnlyList<Baby>> ListAsync()
    {
        await using var db = _db();
        return await new BabyRepository(db).ListForUserAsync(_anna.Id);
    }

    [Test]
    public async Task ListForUser_returns_only_the_babies_of_the_users_families()
    {
        var carl = new User
        {
            Id = Guid.NewGuid(),
            Email = "carl@mail.com",
            DisplayName = "Carl",
            PasswordHash = "hash",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        Guid othersId;
        await using (var db = _db())
        {
            await new UserRepository(db).AddAsync(carl);
            othersId = (await TestFamilies.SeedAsync(db, carl)).Id;
        }

        await AddAsync("Lea", new DateOnly(2026, 9, 1));
        await AddAsync("Zoe", new DateOnly(2025, 1, 1), familyId: othersId);

        Assert.That((await ListAsync()).Select(b => b.Name), Is.EqualTo(new[] { "Lea" }));
        await using var check = _db();
        Assert.That((await new BabyRepository(check).ListForUserAsync(carl.Id)).Select(b => b.Name), Is.EqualTo(new[] { "Zoe" }));
    }

    [Test]
    public async Task Added_baby_is_read_back_with_every_field()
    {
        var added = await AddAsync("Lea", new DateOnly(2026, 9, 1), change: b =>
        {
            b.Sex = Sex.Girl;
            b.BirthWeightG = 3400;
            b.BirthLengthCm = 50.5m;
            b.BirthHeadCircumferenceCm = 34.5m;
        });

        var read = (await ListAsync()).Single();

        Assert.Multiple(() =>
        {
            Assert.That(read.Id, Is.EqualTo(added.Id));
            Assert.That(read.Name, Is.EqualTo("Lea"));
            Assert.That(read.BirthDate, Is.EqualTo(new DateOnly(2026, 9, 1)));
            Assert.That(read.Sex, Is.EqualTo(Sex.Girl));
            Assert.That(read.BirthWeightG, Is.EqualTo(3400));
            Assert.That(read.BirthLengthCm, Is.EqualTo(50.5m));
            Assert.That(read.BirthHeadCircumferenceCm, Is.EqualTo(34.5m));
            Assert.That(read.CreatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(read.CreatedAt, Is.EqualTo(Now));
            Assert.That(read.UpdatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Optional_fields_are_read_back_empty()
    {
        await AddAsync("Lea", new DateOnly(2026, 9, 1));

        var read = (await ListAsync()).Single();

        Assert.That(read.Sex, Is.EqualTo(Sex.Unspecified));
        Assert.That(read.BirthWeightG, Is.Null);
        Assert.That(read.BirthLengthCm, Is.Null);
        Assert.That(read.BirthHeadCircumferenceCm, Is.Null);
    }

    [Test]
    public async Task Babies_are_listed_oldest_first_then_by_creation()
    {
        await AddAsync("Lea", new DateOnly(2026, 9, 1));
        await AddAsync("Twin B", new DateOnly(2024, 3, 1), Now.AddMinutes(1));
        await AddAsync("Twin A", new DateOnly(2024, 3, 1), Now);

        var names = (await ListAsync()).Select(b => b.Name);

        Assert.That(names, Is.EqualTo(new[] { "Twin A", "Twin B", "Lea" }));
    }

    [Test]
    public async Task Get_returns_the_baby_or_null()
    {
        var lea = await AddAsync("Lea", new DateOnly(2026, 9, 1));

        await using var db = _db();
        var repository = new BabyRepository(db);
        Assert.That((await repository.GetAsync(lea.Id))?.Name, Is.EqualTo("Lea"));
        Assert.That(await repository.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Update_persists_the_changes()
    {
        var lea = await AddAsync("Lea", new DateOnly(2026, 9, 1), change: b => b.BirthWeightG = 3400);

        await using (var db = _db())
        {
            var repository = new BabyRepository(db);
            var baby = (await repository.GetAsync(lea.Id))!;
            baby.Name = "Léa";
            baby.Sex = Sex.Boy;
            baby.BirthWeightG = null;
            baby.BirthLengthCm = 51.5m;
            baby.UpdatedAt = Now.AddHours(1);
            await repository.UpdateAsync(baby);
        }

        var read = (await ListAsync()).Single();
        Assert.Multiple(() =>
        {
            Assert.That(read.Name, Is.EqualTo("Léa"));
            Assert.That(read.Sex, Is.EqualTo(Sex.Boy));
            Assert.That(read.BirthWeightG, Is.Null);
            Assert.That(read.BirthLengthCm, Is.EqualTo(51.5m));
            Assert.That(read.UpdatedAt, Is.EqualTo(Now.AddHours(1)));
            Assert.That(read.CreatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Delete_removes_only_that_baby()
    {
        var lea = await AddAsync("Lea", new DateOnly(2026, 9, 1));
        await AddAsync("Tom", new DateOnly(2024, 3, 1));

        await using (var db = _db())
        {
            var repository = new BabyRepository(db);
            await repository.DeleteAsync((await repository.GetAsync(lea.Id))!);
        }

        Assert.That((await ListAsync()).Select(b => b.Name), Is.EqualTo(new[] { "Tom" }));
    }
}
