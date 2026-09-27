using Nala.Core.Admin;
using Nala.Core.Auth;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class AdminServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeSessionRepository _sessions = null!;
    private AdminService _service = null!;
    private User _anna = null!;
    private User _ben = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _sessions = new FakeSessionRepository();
        _service = new AdminService(_users, _sessions);
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

    private void AddSession(User user)
    {
        var session = new Session { Id = Guid.NewGuid(), UserId = user.Id, CreatedAt = Now, LastSeenAt = Now };
        _sessions.Sessions.Add(session.Id, session);
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
        chloe.IsDisabled = true;
        NewUser("Deleted").DeletedAt = Now;

        var result = await _service.ListUsersAsync(_anna);

        Assert.That(((ListUsersResult.Listed)result).Users, Is.EqualTo(new[] { _anna, _ben, chloe, zoe }));
    }

    [Test]
    public async Task Disable_sets_the_flag_and_ends_every_session_of_the_user()
    {
        AddSession(_ben);
        AddSession(_ben);
        AddSession(_anna);

        var result = await _service.SetDisabledAsync(_anna, _ben.Id, disabled: true);

        Assert.That(result, Is.EqualTo(new SetDisabledResult.Updated(_ben)));
        Assert.That(_ben.IsDisabled, Is.True);
        Assert.That(_users.Updates, Is.EqualTo(1));
        Assert.That(_sessions.Sessions.Values.Select(s => s.UserId), Is.EqualTo(new[] { _anna.Id }));
    }

    [Test]
    public async Task Enable_clears_the_flag()
    {
        _ben.IsDisabled = true;

        var result = await _service.SetDisabledAsync(_anna, _ben.Id, disabled: false);

        Assert.That(result, Is.EqualTo(new SetDisabledResult.Updated(_ben)));
        Assert.That(_ben.IsDisabled, Is.False);
        Assert.That(_users.Updates, Is.EqualTo(1));
    }

    [Test]
    public async Task Disable_is_refused_to_a_non_admin()
    {
        var chloe = NewUser("Chloe");

        Assert.That(await _service.SetDisabledAsync(_ben, chloe.Id, disabled: true), Is.InstanceOf<SetDisabledResult.Forbidden>());
        Assert.That(chloe.IsDisabled, Is.False);
        Assert.That(_users.Updates, Is.Zero);
    }

    [Test]
    public async Task Admin_cannot_disable_themselves()
    {
        AddSession(_anna);

        Assert.That(await _service.SetDisabledAsync(_anna, _anna.Id, disabled: true), Is.InstanceOf<SetDisabledResult.AdminCannotDisable>());
        Assert.That(_anna.IsDisabled, Is.False);
        Assert.That(_sessions.Sessions, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Disabling_an_unknown_or_deleted_user_is_not_found()
    {
        var deleted = NewUser("Deleted");
        deleted.DeletedAt = Now;

        Assert.That(await _service.SetDisabledAsync(_anna, Guid.NewGuid(), disabled: true), Is.InstanceOf<SetDisabledResult.NotFound>());
        Assert.That(await _service.SetDisabledAsync(_anna, deleted.Id, disabled: true), Is.InstanceOf<SetDisabledResult.NotFound>());
        Assert.That(deleted.IsDisabled, Is.False);
    }
}
