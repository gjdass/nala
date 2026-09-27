using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class UserRepositoryTests
{
    private Func<NalaDbContext> _db = null!;

    [SetUp]
    public async Task SetUp() => _db = await TestDatabase.CreateAsync();

    private static User NewUser(string email, bool isAdmin = false) => new()
    {
        Id = Guid.NewGuid(),
        Email = email,
        DisplayName = "Anna",
        PasswordHash = "hash",
        PreferredLanguage = "en",
        IsAdmin = isAdmin,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private async Task AddAsync(User user)
    {
        await using var db = _db();
        await new UserRepository(db).AddAsync(user);
    }

    [Test]
    public async Task Added_user_is_read_back()
    {
        var user = NewUser("anna@mail.com", isAdmin: true);
        await AddAsync(user);

        await using var db = _db();
        var repository = new UserRepository(db);
        var read = await repository.GetByIdAsync(user.Id);

        Assert.That(await repository.AnyAsync(), Is.True);
        Assert.That(read, Is.Not.Null);
        Assert.That(read!.Email, Is.EqualTo("anna@mail.com"));
        Assert.That(read.IsAdmin, Is.True);
        Assert.That(read.CreatedAt, Is.EqualTo(user.CreatedAt).Within(TimeSpan.FromMilliseconds(1)));
    }

    [Test]
    public async Task Empty_database_has_no_user()
    {
        await using var db = _db();
        Assert.That(await new UserRepository(db).AnyAsync(), Is.False);
    }

    [Test]
    public async Task Email_unique_among_non_deleted_users()
    {
        await AddAsync(NewUser("anna@mail.com"));

        await Assert.ThatAsync(() => AddAsync(NewUser("anna@mail.com")), Throws.TypeOf<UserConflictException>());
    }

    [Test]
    public async Task Deleted_user_email_can_be_reused()
    {
        var deleted = NewUser("anna@mail.com");
        deleted.DeletedAt = DateTimeOffset.UtcNow;
        await AddAsync(deleted);

        await Assert.ThatAsync(() => AddAsync(NewUser("anna@mail.com")), Throws.Nothing);
    }

    [Test]
    public async Task Only_one_admin()
    {
        await AddAsync(NewUser("anna@mail.com", isAdmin: true));

        await Assert.ThatAsync(() => AddAsync(NewUser("ben@mail.com", isAdmin: true)), Throws.TypeOf<UserConflictException>());
    }

    [Test]
    public async Task GetByEmail_finds_the_non_deleted_user()
    {
        var deleted = NewUser("anna@mail.com");
        deleted.DeletedAt = DateTimeOffset.UtcNow;
        var anna = NewUser("anna@mail.com");
        await AddAsync(deleted);
        await AddAsync(anna);

        await using var db = _db();
        var repository = new UserRepository(db);

        Assert.That((await repository.GetByEmailAsync("anna@mail.com"))?.Id, Is.EqualTo(anna.Id));
        Assert.That(await repository.GetByEmailAsync("ben@mail.com"), Is.Null);
    }
}
