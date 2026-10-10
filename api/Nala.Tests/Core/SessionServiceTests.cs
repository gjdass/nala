using Nala.Core.Auth;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class SessionServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeSessionRepository _sessions = null!;
    private FixedTimeProvider _time = null!;
    private SessionService _service = null!;
    private User _anna = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _sessions = new FakeSessionRepository();
        _time = new FixedTimeProvider(Now);
        _service = new SessionService(_sessions, _users, _time);
        _anna = new User { Id = Guid.NewGuid(), Email = "anna@mail.com", DisplayName = "Anna", PreferredLanguage = "en" };
        _users.Users.Add(_anna);
    }

    [Test]
    public async Task Start_creates_a_session_for_the_user()
    {
        var session = await _service.StartAsync(_anna);

        Assert.That(_sessions.Sessions[session.Id], Is.SameAs(session));
        Assert.That(session.Id, Is.Not.EqualTo(Guid.Empty));
        Assert.That(session.UserId, Is.EqualTo(_anna.Id));
        Assert.That(session.CreatedAt, Is.EqualTo(Now));
        Assert.That(session.LastSeenAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Validate_returns_the_user_of_a_live_session()
    {
        var session = await _service.StartAsync(_anna);

        var validation = await _service.ValidateAsync(session.Id);

        Assert.That(validation?.User, Is.SameAs(_anna));
    }

    [Test]
    public async Task Validate_extends_the_session_on_use()
    {
        var session = await _service.StartAsync(_anna);
        _time.Now = Now + TimeSpan.FromDays(10);

        var validation = await _service.ValidateAsync(session.Id);

        Assert.That(validation?.Renewed, Is.True);
        Assert.That(session.LastSeenAt, Is.EqualTo(_time.Now));
        Assert.That(_sessions.Touches, Is.EqualTo(1));
    }

    [Test]
    public async Task Uses_within_the_touch_interval_do_not_write()
    {
        var session = await _service.StartAsync(_anna);
        _time.Now = Now + SessionPolicy.TouchInterval - TimeSpan.FromSeconds(1);

        var validation = await _service.ValidateAsync(session.Id);

        Assert.That(validation?.Renewed, Is.False);
        Assert.That(session.LastSeenAt, Is.EqualTo(Now));
        Assert.That(_sessions.Touches, Is.Zero);
    }

    [Test]
    public async Task Session_unused_for_90_days_expires_and_is_deleted()
    {
        var session = await _service.StartAsync(_anna);
        _time.Now = Now + SessionPolicy.IdleTimeout;

        Assert.That(await _service.ValidateAsync(session.Id), Is.Null);
        Assert.That(_sessions.Sessions, Is.Empty);
    }

    [Test]
    public async Task Session_used_every_89_days_never_expires()
    {
        var session = await _service.StartAsync(_anna);

        for (var i = 1; i <= 5; i++)
        {
            _time.Now = Now + TimeSpan.FromDays(89 * i);
            Assert.That(await _service.ValidateAsync(session.Id), Is.Not.Null, $"use {i}");
        }
    }

    [Test]
    public async Task Unknown_session_is_rejected()
    {
        Assert.That(await _service.ValidateAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Session_of_a_deleted_user_is_rejected_and_deleted()
    {
        var session = await _service.StartAsync(_anna);
        _anna.DeletedAt = Now;

        Assert.That(await _service.ValidateAsync(session.Id), Is.Null);
        Assert.That(_sessions.Sessions, Is.Empty);
    }

    [Test]
    public async Task Starting_a_session_sets_last_activity()
    {
        await _service.StartAsync(_anna);

        Assert.That(_anna.LastActivityAt, Is.EqualTo(Now));
        Assert.That(_users.ActivityWrites, Is.EqualTo(1));
    }

    [Test]
    public async Task A_written_touch_updates_last_activity()
    {
        var session = await _service.StartAsync(_anna);
        _time.Now = Now + TimeSpan.FromDays(3);

        await _service.ValidateAsync(session.Id);

        Assert.That(_anna.LastActivityAt, Is.EqualTo(_time.Now));
        Assert.That(_users.ActivityWrites, Is.EqualTo(2));
    }

    [Test]
    public async Task A_use_within_the_touch_interval_does_not_update_last_activity()
    {
        var session = await _service.StartAsync(_anna);
        _time.Now = Now + SessionPolicy.TouchInterval - TimeSpan.FromSeconds(1);

        await _service.ValidateAsync(session.Id);

        Assert.That(_anna.LastActivityAt, Is.EqualTo(Now));
        Assert.That(_users.ActivityWrites, Is.EqualTo(1));
    }

    [Test]
    public async Task End_deletes_only_that_session()
    {
        var phone = await _service.StartAsync(_anna);
        var tablet = await _service.StartAsync(_anna);

        await _service.EndAsync(phone.Id);

        Assert.That(_sessions.Sessions.Keys, Is.EqualTo(new[] { tablet.Id }));
    }
}
