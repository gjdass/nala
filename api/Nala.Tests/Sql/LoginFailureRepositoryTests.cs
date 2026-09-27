using Nala.Sql;
using Nala.Sql.Auth;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class LoginFailureRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;

    [SetUp]
    public async Task SetUp() => _db = await TestDatabase.CreateAsync();

    private async Task AddAsync(string email, DateTimeOffset at)
    {
        await using var db = _db();
        await new LoginFailureRepository(db).AddAsync(email, at);
    }

    private async Task<int> CountSinceAsync(string email, DateTimeOffset since)
    {
        await using var db = _db();
        return await new LoginFailureRepository(db).CountSinceAsync(email, since);
    }

    [Test]
    public async Task Counts_failures_of_that_email_strictly_after_since()
    {
        await AddAsync("anna@mail.com", Now.AddMinutes(-20));
        await AddAsync("anna@mail.com", Now.AddMinutes(-15));
        await AddAsync("anna@mail.com", Now.AddMinutes(-1));
        await AddAsync("anna@mail.com", Now);
        await AddAsync("ben@mail.com", Now);

        Assert.That(await CountSinceAsync("anna@mail.com", Now.AddMinutes(-15)), Is.EqualTo(2));
        Assert.That(await CountSinceAsync("nobody@mail.com", Now.AddMinutes(-15)), Is.Zero);
    }

    [Test]
    public async Task Clear_removes_only_that_email()
    {
        await AddAsync("anna@mail.com", Now);
        await AddAsync("ben@mail.com", Now);

        await using (var db = _db())
        {
            await new LoginFailureRepository(db).ClearAsync("anna@mail.com");
        }

        Assert.That(await CountSinceAsync("anna@mail.com", Now.AddDays(-1)), Is.Zero);
        Assert.That(await CountSinceAsync("ben@mail.com", Now.AddDays(-1)), Is.EqualTo(1));
    }
}
