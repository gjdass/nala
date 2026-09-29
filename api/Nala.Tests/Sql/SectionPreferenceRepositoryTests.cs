using Nala.Core.Sections;
using Nala.Core.Users;
using Nala.Sql;
using Nala.Sql.Sections;
using Nala.Sql.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Sql;

public class SectionPreferenceRepositoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 20, 0, 0, TimeSpan.Zero);

    private Func<NalaDbContext> _db = null!;
    private User _anna = null!;
    private User _ben = null!;

    [SetUp]
    public async Task SetUp()
    {
        _db = await TestDatabase.CreateAsync();
        _anna = NewUser("anna");
        _ben = NewUser("ben");
        await using var db = _db();
        var users = new UserRepository(db);
        await users.AddAsync(_anna);
        await users.AddAsync(_ben);
    }

    private static User NewUser(string name) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name}@mail.com",
        DisplayName = name,
        PasswordHash = "hash",
        PreferredLanguage = "en",
        CreatedAt = Now,
    };

    private static SectionPreference[] Rows(Guid userId, params (string Key, bool Visible)[] rows) =>
        rows.Select((r, i) => new SectionPreference { UserId = userId, Key = r.Key, Position = i, Visible = r.Visible }).ToArray();

    private async Task ReplaceAsync(Guid userId, SectionPreference[] rows)
    {
        await using var db = _db();
        await new SectionPreferenceRepository(db).ReplaceAsync(userId, rows);
    }

    private async Task<IReadOnlyList<SectionPreference>> ListAsync(Guid userId)
    {
        await using var db = _db();
        return await new SectionPreferenceRepository(db).ListAsync(userId);
    }

    [Test]
    public async Task Nothing_is_stored_for_a_new_user()
    {
        Assert.That(await ListAsync(_anna.Id), Is.Empty);
    }

    [Test]
    public async Task Rows_are_listed_by_position()
    {
        await ReplaceAsync(_anna.Id, Rows(_anna.Id, ("sleep", true), ("feed", false), ("pump", true)).Reverse().ToArray());

        var rows = await ListAsync(_anna.Id);

        Assert.That(rows.Select(r => (r.Key, r.Position, r.Visible)),
            Is.EqualTo(new[] { ("sleep", 0, true), ("feed", 1, false), ("pump", 2, true) }));
    }

    [Test]
    public async Task Replacing_removes_the_previous_rows_of_that_user_only()
    {
        await ReplaceAsync(_anna.Id, Rows(_anna.Id, ("feed", true), ("sleep", true)));
        await ReplaceAsync(_ben.Id, Rows(_ben.Id, ("diaper", false)));

        await ReplaceAsync(_anna.Id, Rows(_anna.Id, ("sleep", false), ("growth", true)));

        Assert.That((await ListAsync(_anna.Id)).Select(r => (r.Key, r.Visible)),
            Is.EqualTo(new[] { ("sleep", false), ("growth", true) }));
        Assert.That((await ListAsync(_ben.Id)).Select(r => (r.Key, r.Visible)),
            Is.EqualTo(new[] { ("diaper", false) }));
    }
}
