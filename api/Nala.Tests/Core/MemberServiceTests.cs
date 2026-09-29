using Nala.Core.Members;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class MemberServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private MemberService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _service = new MemberService(_users);
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
    public async Task List_has_enabled_non_deleted_users_admin_first_then_by_name()
    {
        var zoe = NewUser("zoé");
        var anna = NewUser("Anna", isAdmin: true);
        var ben = NewUser("Ben");
        NewUser("Chloe").IsDisabled = true;
        NewUser("Deleted").DeletedAt = Now;

        Assert.That(await _service.ListAsync(), Is.EqualTo(new[] { anna, ben, zoe }));
    }

    [Test]
    public async Task Admin_is_first_even_when_their_name_sorts_last()
    {
        var ben = NewUser("Ben");
        var zack = NewUser("Zack", isAdmin: true);

        Assert.That(await _service.ListAsync(), Is.EqualTo(new[] { zack, ben }));
    }
}
