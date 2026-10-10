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

    [Test]
    public async Task Update_saves_display_name_language_and_password_hash()
    {
        var user = NewUser("anna@mail.com");
        await AddAsync(user);

        await using (var db = _db())
        {
            var repository = new UserRepository(db);
            var read = (await repository.GetByIdAsync(user.Id))!;
            read.DisplayName = "Anna B.";
            read.PreferredLanguage = "fr";
            read.PasswordHash = "new hash";
            await repository.UpdateAsync(read);
        }

        await using var check = _db();
        var saved = (await new UserRepository(check).GetByIdAsync(user.Id))!;
        Assert.That(saved.DisplayName, Is.EqualTo("Anna B."));
        Assert.That(saved.PreferredLanguage, Is.EqualTo("fr"));
        Assert.That(saved.PasswordHash, Is.EqualTo("new hash"));
    }

    [Test]
    public async Task Update_saves_a_soft_delete()
    {
        var user = NewUser("anna@mail.com");
        await AddAsync(user);
        var deletedAt = new DateTimeOffset(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

        await using (var db = _db())
        {
            var repository = new UserRepository(db);
            var read = (await repository.GetByIdAsync(user.Id))!;
            read.Email = null;
            read.PasswordHash = null;
            read.DeletedAt = deletedAt;
            await repository.UpdateAsync(read);
        }

        await using var check = _db();
        var repository2 = new UserRepository(check);
        var saved = (await repository2.GetByIdAsync(user.Id))!;
        Assert.That(saved.Email, Is.Null);
        Assert.That(saved.PasswordHash, Is.Null);
        Assert.That(saved.DeletedAt, Is.EqualTo(deletedAt));
        Assert.That(saved.DisplayName, Is.EqualTo("Anna"));
        Assert.That(await repository2.GetByEmailAsync("anna@mail.com"), Is.Null);
    }

    [Test]
    public async Task ListActive_excludes_deleted_users()
    {
        var deleted = NewUser("ben@mail.com");
        deleted.DeletedAt = DateTimeOffset.UtcNow;
        var anna = NewUser("anna@mail.com", isAdmin: true);
        var chloe = NewUser("chloe@mail.com");
        await AddAsync(deleted);
        await AddAsync(anna);
        await AddAsync(chloe);

        await using var db = _db();
        var users = await new UserRepository(db).ListActiveAsync();

        Assert.That(users.Select(u => u.Id), Is.EquivalentTo(new[] { anna.Id, chloe.Id }));
    }

    [Test]
    public async Task SetLastActivity_saves_the_time()
    {
        var user = NewUser("anna@mail.com");
        await AddAsync(user);
        var at = new DateTimeOffset(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

        await using (var db = _db())
        {
            await new UserRepository(db).SetLastActivityAsync(user.Id, at);
        }

        await using var check = _db();
        Assert.That((await new UserRepository(check).GetByIdAsync(user.Id))!.LastActivityAt, Is.EqualTo(at));
    }

}
