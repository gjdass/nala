using Nala.Core.Account;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class AccountServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeSessionRepository _sessions = null!;
    private FakeInvitationRepository _invitations = null!;
    private AccountService _service = null!;
    private User _anna = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _sessions = new FakeSessionRepository();
        _invitations = new FakeInvitationRepository(_users);
        _service = new AccountService(
            _users, _sessions, _invitations, new FakePasswordHasher(), new FixedTimeProvider(Now));
        _anna = new User
        {
            Id = Guid.NewGuid(),
            Email = "anna@mail.com",
            DisplayName = "Anna",
            PasswordHash = "hashed:correct horse",
            PreferredLanguage = "en",
        };
        _users.Users.Add(_anna);
    }

    private Session AddSession(Guid userId)
    {
        var session = new Session { Id = Guid.NewGuid(), UserId = userId, CreatedAt = Now, LastSeenAt = Now };
        _sessions.Sessions.Add(session.Id, session);
        return session;
    }

    private Invitation AddInvitation(Guid createdBy, Action<Invitation>? change = null)
    {
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = Guid.NewGuid().ToString(),
            CreatedByUserId = createdBy,
            CreatedAt = Now,
            ExpiresAt = Now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        _invitations.Invitations.Add(invitation);
        return invitation;
    }

    [Test]
    public async Task Update_changes_the_display_name_trimmed()
    {
        var result = await _service.UpdateAsync(_anna, new UpdateAccountCommand(" Anna B. ", null));

        Assert.That(result, Is.InstanceOf<UpdateAccountResult.Updated>());
        Assert.That(_anna.DisplayName, Is.EqualTo("Anna B."));
        Assert.That(_users.Updates, Is.EqualTo(1));
    }

    [Test]
    public async Task Update_changes_the_language()
    {
        await _service.UpdateAsync(_anna, new UpdateAccountCommand(null, "fr"));

        Assert.That(_anna.PreferredLanguage, Is.EqualTo("fr"));
    }

    [Test]
    public async Task Update_leaves_omitted_fields_unchanged()
    {
        await _service.UpdateAsync(_anna, new UpdateAccountCommand(null, null));

        Assert.That(_anna.DisplayName, Is.EqualTo("Anna"));
        Assert.That(_anna.PreferredLanguage, Is.EqualTo("en"));
    }

    [TestCase("  ", "required")]
    [TestCase("", "required")]
    public async Task Update_rejects_an_empty_display_name(string displayName, string code)
    {
        var result = await _service.UpdateAsync(_anna, new UpdateAccountCommand(displayName, "fr"));

        Assert.That(((UpdateAccountResult.Invalid)result).Errors["displayName"], Is.EqualTo(code));
        Assert.That(_anna.DisplayName, Is.EqualTo("Anna"));
        Assert.That(_anna.PreferredLanguage, Is.EqualTo("en"), "nothing is saved when a field is invalid");
        Assert.That(_users.Updates, Is.Zero);
    }

    [Test]
    public async Task Update_rejects_a_too_long_display_name()
    {
        var result = await _service.UpdateAsync(_anna, new UpdateAccountCommand(new string('a', 51), null));

        Assert.That(((UpdateAccountResult.Invalid)result).Errors["displayName"], Is.EqualTo("tooLong"));
    }

    [TestCase("de")]
    [TestCase("")]
    public async Task Update_rejects_an_unsupported_language(string language)
    {
        var result = await _service.UpdateAsync(_anna, new UpdateAccountCommand(null, language));

        Assert.That(((UpdateAccountResult.Invalid)result).Errors["language"], Is.EqualTo("invalid"));
        Assert.That(_anna.PreferredLanguage, Is.EqualTo("en"));
    }

    [Test]
    public async Task Change_password_with_the_right_current_password_stores_a_new_hash()
    {
        var current = AddSession(_anna.Id);

        var result = await _service.ChangePasswordAsync(
            _anna, current.Id, new ChangePasswordCommand("correct horse", "battery staple"));

        Assert.That(result, Is.InstanceOf<ChangePasswordResult.Changed>());
        Assert.That(_anna.PasswordHash, Is.EqualTo("hashed:battery staple"));
        Assert.That(_users.Updates, Is.EqualTo(1));
    }

    [Test]
    public async Task Change_password_with_a_wrong_current_password_is_incorrect()
    {
        var current = AddSession(_anna.Id);
        var other = AddSession(_anna.Id);

        var result = await _service.ChangePasswordAsync(
            _anna, current.Id, new ChangePasswordCommand("wrong horse", "battery staple"));

        Assert.That(((ChangePasswordResult.Invalid)result).Errors["currentPassword"], Is.EqualTo("incorrect"));
        Assert.That(_anna.PasswordHash, Is.EqualTo("hashed:correct horse"));
        Assert.That(_sessions.Sessions.Keys, Does.Contain(other.Id));
    }

    [Test]
    public async Task Change_password_requires_both_fields()
    {
        var result = await _service.ChangePasswordAsync(_anna, Guid.NewGuid(), new ChangePasswordCommand("", null));

        var errors = ((ChangePasswordResult.Invalid)result).Errors;
        Assert.That(errors["currentPassword"], Is.EqualTo("required"));
        Assert.That(errors["newPassword"], Is.EqualTo("required"));
    }

    [Test]
    public async Task Change_password_rejects_a_short_new_password()
    {
        var result = await _service.ChangePasswordAsync(
            _anna, Guid.NewGuid(), new ChangePasswordCommand("correct horse", "short"));

        Assert.That(((ChangePasswordResult.Invalid)result).Errors["newPassword"], Is.EqualTo("tooShort"));
        Assert.That(_anna.PasswordHash, Is.EqualTo("hashed:correct horse"));
    }

    [Test]
    public async Task Change_password_ends_the_other_sessions_and_keeps_the_current_one()
    {
        var current = AddSession(_anna.Id);
        var other = AddSession(_anna.Id);
        var someoneElse = AddSession(Guid.NewGuid());

        await _service.ChangePasswordAsync(_anna, current.Id, new ChangePasswordCommand("correct horse", "battery staple"));

        Assert.That(_sessions.Sessions.Keys, Is.EquivalentTo(new[] { current.Id, someoneElse.Id }));
        Assert.That(_sessions.Sessions.Keys, Does.Not.Contain(other.Id));
    }

    [Test]
    public async Task Delete_soft_deletes_clearing_email_and_password_hash()
    {
        var result = await _service.DeleteAsync(_anna, new DeleteAccountCommand("correct horse"));

        Assert.That(result, Is.InstanceOf<DeleteAccountResult.Deleted>());
        Assert.That(_anna.DeletedAt, Is.EqualTo(Now));
        Assert.That(_anna.Email, Is.Null);
        Assert.That(_anna.PasswordHash, Is.Null);
        Assert.That(_anna.DisplayName, Is.EqualTo("Anna"), "entries still show who logged them");
        Assert.That(_users.Users, Does.Contain(_anna), "the account row is kept");
        Assert.That(_users.Updates, Is.EqualTo(1));
    }

    [Test]
    public async Task Delete_ends_all_sessions_of_the_user()
    {
        AddSession(_anna.Id);
        AddSession(_anna.Id);
        var someoneElse = AddSession(Guid.NewGuid());

        await _service.DeleteAsync(_anna, new DeleteAccountCommand("correct horse"));

        Assert.That(_sessions.Sessions.Keys, Is.EquivalentTo(new[] { someoneElse.Id }));
    }

    [Test]
    public async Task Delete_revokes_pending_invitations_created_by_the_user()
    {
        var pending = AddInvitation(_anna.Id);
        var used = AddInvitation(_anna.Id, i => i.UsedAt = Now.AddDays(-1));
        var expired = AddInvitation(_anna.Id, i => i.ExpiresAt = Now.AddDays(-1));
        var revoked = AddInvitation(_anna.Id, i => i.RevokedAt = Now.AddDays(-2));
        var someoneElses = AddInvitation(Guid.NewGuid());

        await _service.DeleteAsync(_anna, new DeleteAccountCommand("correct horse"));

        Assert.That(pending.RevokedAt, Is.EqualTo(Now));
        Assert.That(used.RevokedAt, Is.Null);
        Assert.That(expired.RevokedAt, Is.Null);
        Assert.That(revoked.RevokedAt, Is.EqualTo(Now.AddDays(-2)));
        Assert.That(someoneElses.RevokedAt, Is.Null);
    }

    [TestCase("wrong horse", "incorrect")]
    [TestCase("", "required")]
    [TestCase(null, "required")]
    public async Task Delete_needs_the_right_password(string? password, string code)
    {
        var session = AddSession(_anna.Id);
        var pending = AddInvitation(_anna.Id);

        var result = await _service.DeleteAsync(_anna, new DeleteAccountCommand(password));

        Assert.That(((DeleteAccountResult.Invalid)result).Errors["password"], Is.EqualTo(code));
        Assert.That(_anna.DeletedAt, Is.Null);
        Assert.That(_anna.Email, Is.EqualTo("anna@mail.com"));
        Assert.That(_users.Updates, Is.Zero);
        Assert.That(_sessions.Sessions.Keys, Does.Contain(session.Id));
        Assert.That(pending.RevokedAt, Is.Null);
    }

    [Test]
    public async Task Delete_refuses_the_admin()
    {
        var admin = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin@mail.com",
            DisplayName = "Admin",
            PasswordHash = "hashed:correct horse",
            PreferredLanguage = "en",
            IsAdmin = true,
        };
        _users.Users.Add(admin);
        var session = AddSession(admin.Id);

        var result = await _service.DeleteAsync(admin, new DeleteAccountCommand("correct horse"));

        Assert.That(result, Is.InstanceOf<DeleteAccountResult.AdminCannotDelete>());
        Assert.That(admin.DeletedAt, Is.Null);
        Assert.That(admin.Email, Is.EqualTo("admin@mail.com"));
        Assert.That(_users.Updates, Is.Zero);
        Assert.That(_sessions.Sessions.Keys, Does.Contain(session.Id));
    }
}
