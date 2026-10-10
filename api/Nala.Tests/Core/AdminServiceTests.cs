using Nala.Core.Admin;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class AdminServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private AdminService _service = null!;
    private User _anna = null!;
    private User _ben = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _service = new AdminService(_users);
        _anna = NewUser("Anna", isAdmin: true);
        _ben = NewUser("Ben");
    }

    private User NewUser(string name, bool isAdmin = false)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = $"{name.ToLowerInvariant()}@mail.com",
            DisplayName = name,
            PreferredLanguage = "en",
            IsAdmin = isAdmin,
        };
        _users.Users.Add(user);
        return user;
    }

    [Test]
    public async Task List_is_refused_to_a_non_admin()
    {
        Assert.That(await _service.ListUsersAsync(_ben), Is.InstanceOf<ListUsersResult.Forbidden>());
    }

    [Test]
    public async Task List_excludes_deleted_users_and_puts_the_admin_first_then_by_name()
    {
        var zoe = NewUser("zoé");
        var chloe = NewUser("Chloe");
        NewUser("Deleted").DeletedAt = Now;

        var result = await _service.ListUsersAsync(_anna);

        Assert.That(((ListUsersResult.Listed)result).Users, Is.EqualTo(new[] { _anna, _ben, chloe, zoe }));
    }
}
