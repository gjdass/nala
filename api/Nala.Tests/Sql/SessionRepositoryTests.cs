using Nala.Core.Auth;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Auth;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class SessionRepositoryTests
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

    private Session NewSession() => new() { Id = Guid.NewGuid(), UserId = _anna.Id, CreatedAt = Now, LastSeenAt = Now };

    private async Task AddAsync(Session session)
    {
        await using var db = _db();
        await new SessionRepository(db).AddAsync(session);
    }

    private async Task<Session?> GetAsync(Guid id)
    {
        await using var db = _db();
        return await new SessionRepository(db).GetAsync(id);
    }

    [Test]
    public async Task Added_session_is_read_back()
    {
        var session = NewSession();
        await AddAsync(session);

        var read = await GetAsync(session.Id);

        Assert.That(read, Is.Not.Null);
        Assert.That(read!.UserId, Is.EqualTo(_anna.Id));
        Assert.That(read.CreatedAt, Is.EqualTo(Now));
        Assert.That(read.LastSeenAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Unknown_session_is_null()
    {
        Assert.That(await GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Touch_saves_last_seen()
    {
        var session = NewSession();
        await AddAsync(session);

        await using (var db = _db())
        {
            var repository = new SessionRepository(db);
            var read = (await repository.GetAsync(session.Id))!;
            read.LastSeenAt = Now.AddDays(3);
            await repository.TouchAsync(read);
        }

        Assert.That((await GetAsync(session.Id))!.LastSeenAt, Is.EqualTo(Now.AddDays(3)));
    }

    [Test]
    public async Task Delete_removes_only_that_session()
    {
        var phone = NewSession();
        var tablet = NewSession();
        await AddAsync(phone);
        await AddAsync(tablet);

        await using (var db = _db())
        {
            await new SessionRepository(db).DeleteAsync(phone.Id);
        }

        Assert.That(await GetAsync(phone.Id), Is.Null);
        Assert.That(await GetAsync(tablet.Id), Is.Not.Null);
    }

    [Test]
    public async Task Deleting_an_unknown_session_does_nothing()
    {
        await using var db = _db();

        await Assert.ThatAsync(() => new SessionRepository(db).DeleteAsync(Guid.NewGuid()), Throws.Nothing);
    }

    [Test]
    public async Task DeleteOthers_deletes_the_users_other_sessions_only()
    {
        var bob = new User
        {
            Id = Guid.NewGuid(),
            Email = "bob@mail.com",
            DisplayName = "Bob",
            PasswordHash = "hash",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        await using (var db = _db())
        {
            await new UserRepository(db).AddAsync(bob);
        }

        var current = NewSession();
        var other = NewSession();
        var bobs = new Session { Id = Guid.NewGuid(), UserId = bob.Id, CreatedAt = Now, LastSeenAt = Now };
        await AddAsync(current);
        await AddAsync(other);
        await AddAsync(bobs);

        await using (var db = _db())
        {
            await new SessionRepository(db).DeleteOthersAsync(_anna.Id, current.Id);
        }

        Assert.That(await GetAsync(current.Id), Is.Not.Null);
        Assert.That(await GetAsync(other.Id), Is.Null);
        Assert.That(await GetAsync(bobs.Id), Is.Not.Null);
    }

    [Test]
    public async Task DeleteAll_deletes_every_session_of_the_user_only()
    {
        var bob = new User
        {
            Id = Guid.NewGuid(),
            Email = "bob@mail.com",
            DisplayName = "Bob",
            PasswordHash = "hash",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        await using (var db = _db())
        {
            await new UserRepository(db).AddAsync(bob);
        }

        var phone = NewSession();
        var tablet = NewSession();
        var bobs = new Session { Id = Guid.NewGuid(), UserId = bob.Id, CreatedAt = Now, LastSeenAt = Now };
        await AddAsync(phone);
        await AddAsync(tablet);
        await AddAsync(bobs);

        await using (var db = _db())
        {
            await new SessionRepository(db).DeleteAllAsync(_anna.Id);
        }

        Assert.That(await GetAsync(phone.Id), Is.Null);
        Assert.That(await GetAsync(tablet.Id), Is.Null);
        Assert.That(await GetAsync(bobs.Id), Is.Not.Null);
    }
}
