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
    }

    private async Task<Baby> AddAsync(string name, DateOnly birthDate, DateTimeOffset? createdAt = null, Action<Baby>? change = null)
    {
        var baby = new Baby
        {
            Id = Guid.NewGuid(),
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
        return await new BabyRepository(db).ListAsync();
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
}
