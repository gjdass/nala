using Nala.Core.Auth;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class PasswordResetServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeSessionRepository _sessions = null!;
    private FakeLoginFailureRepository _failures = null!;
    private FakePasswordResetTokenRepository _resets = null!;
    private FakeEmailOutbox _outbox = null!;
    private FixedTimeProvider _time = null!;
    private PasswordResetService _service = null!;
    private User _anna = null!;
    private User _ben = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _sessions = new FakeSessionRepository();
        _failures = new FakeLoginFailureRepository();
        _resets = new FakePasswordResetTokenRepository();
        _outbox = new FakeEmailOutbox();
        _time = new FixedTimeProvider(Now);
        _service = new PasswordResetService(_resets, _users, _sessions, _failures, new FakePasswordHasher(), _outbox, _time);
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
            PasswordHash = "hashed:old password",
            PreferredLanguage = "en",
            IsAdmin = isAdmin,
            CreatedAt = Now,
        };
        _users.Users.Add(user);
        return user;
    }

    /// <summary>A link for Ben created by the admin now; returns its token.</summary>
    private async Task<string> CreateLinkAsync(User? user = null)
    {
        var result = await _service.CreateLinkAsync(_anna, (user ?? _ben).Id);
        return ((CreateResetLinkResult.Created)result).Token;
    }

    private static readonly Uri PublicUrl = new("https://nala.example.com");

    private Task<RequestResetResult> RequestAsync(string? email = "ben@mail.com") =>
        _service.RequestByEmailAsync(email, PublicUrl);

    /// <summary>The token in the link of the only queued email.</summary>
    private string EmailedToken()
    {
        var body = _outbox.Messages.Single().Body;
        var start = body.IndexOf("https://nala.example.com/reset/", StringComparison.Ordinal);
        Assert.That(start, Is.GreaterThanOrEqualTo(0), body);
        return new string(body[(start + "https://nala.example.com/reset/".Length)..].TakeWhile(c => !char.IsWhiteSpace(c)).ToArray());
    }

    private void AddSession(User user)
    {
        var session = new Session { Id = Guid.NewGuid(), UserId = user.Id, CreatedAt = Now, LastSeenAt = Now };
        _sessions.Sessions.Add(session.Id, session);
    }

    [Test]
    public async Task Admin_creates_a_link_valid_24_hours_storing_only_its_hash()
    {
        var result = await _service.CreateLinkAsync(_anna, _ben.Id);

        var created = (CreateResetLinkResult.Created)result;
        Assert.That(created.ExpiresAt, Is.EqualTo(Now + TimeSpan.FromHours(24)));
        var stored = _resets.Tokens.Single();
        Assert.That(stored.UserId, Is.EqualTo(_ben.Id));
        Assert.That(stored.CreatedAt, Is.EqualTo(Now));
        Assert.That(stored.ExpiresAt, Is.EqualTo(created.ExpiresAt));
        Assert.That(stored.UsedAt, Is.Null);
        Assert.That(stored.TokenHash, Is.EqualTo(LinkToken.Hash(created.Token)));
        Assert.That(stored.TokenHash, Is.Not.EqualTo(created.Token));
    }

    [Test]
    public async Task A_new_link_replaces_the_earlier_unused_ones()
    {
        var first = await CreateLinkAsync();
        var second = await CreateLinkAsync();

        Assert.That(await _service.LookupAsync(first), Is.EqualTo(new ResetLinkLookup.Unavailable(ResetLinkProblem.Unknown)));
        Assert.That(await _service.LookupAsync(second), Is.InstanceOf<ResetLinkLookup.Valid>());
    }

    [Test]
    public async Task Creating_a_link_is_refused_to_a_non_admin()
    {
        var chloe = NewUser("Chloe");

        Assert.That(await _service.CreateLinkAsync(_ben, chloe.Id), Is.InstanceOf<CreateResetLinkResult.Forbidden>());
        Assert.That(_resets.Tokens, Is.Empty);
    }

    [Test]
    public async Task Creating_a_link_for_an_unknown_or_deleted_user_is_not_found()
    {
        var deleted = NewUser("Deleted");
        deleted.DeletedAt = Now;

        Assert.That(await _service.CreateLinkAsync(_anna, Guid.NewGuid()), Is.InstanceOf<CreateResetLinkResult.NotFound>());
        Assert.That(await _service.CreateLinkAsync(_anna, deleted.Id), Is.InstanceOf<CreateResetLinkResult.NotFound>());
        Assert.That(_resets.Tokens, Is.Empty);
    }

    [Test]
    public async Task Lookup_of_a_valid_link_returns_the_email_and_expiry()
    {
        var result = await _service.LookupAsync(await CreateLinkAsync());

        Assert.That(result, Is.EqualTo(new ResetLinkLookup.Valid("ben@mail.com", Now + PasswordResetPolicy.AdminLinkLifetime)));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("not-a-token")]
    public async Task Lookup_of_an_unknown_token_is_unknown(string? token) =>
        Assert.That(await _service.LookupAsync(token), Is.EqualTo(new ResetLinkLookup.Unavailable(ResetLinkProblem.Unknown)));

    [Test]
    public async Task Lookup_at_the_expiry_is_expired()
    {
        var token = await CreateLinkAsync();
        _time.Now = Now + PasswordResetPolicy.AdminLinkLifetime;

        Assert.That(await _service.LookupAsync(token), Is.EqualTo(new ResetLinkLookup.Unavailable(ResetLinkProblem.Expired)));
    }

    [Test]
    public async Task Lookup_of_a_used_link_is_used()
    {
        var token = await CreateLinkAsync();
        _resets.Tokens.Single().UsedAt = Now;

        Assert.That(await _service.LookupAsync(token), Is.EqualTo(new ResetLinkLookup.Unavailable(ResetLinkProblem.Used)));
    }

    [Test]
    public async Task Lookup_for_a_deleted_user_is_unknown()
    {
        var token = await CreateLinkAsync();
        _ben.DeletedAt = Now;

        Assert.That(await _service.LookupAsync(token), Is.EqualTo(new ResetLinkLookup.Unavailable(ResetLinkProblem.Unknown)));
    }

    [Test]
    public async Task Reset_sets_the_password_consumes_the_link_ends_every_session_and_clears_login_failures()
    {
        var token = await CreateLinkAsync();
        AddSession(_ben);
        AddSession(_ben);
        AddSession(_anna);
        _failures.Failures.Add(("ben@mail.com", Now));

        var result = await _service.ResetAsync(new ResetPasswordCommand(token, "new password"));

        Assert.That(result, Is.EqualTo(new ResetPasswordResult.Reset(_ben)));
        Assert.That(_ben.PasswordHash, Is.EqualTo("hashed:new password"));
        Assert.That(_users.Updates, Is.EqualTo(1));
        Assert.That(_resets.Tokens.Single().UsedAt, Is.EqualTo(Now));
        Assert.That(_sessions.Sessions.Values.Select(s => s.UserId), Is.EqualTo(new[] { _anna.Id }));
        Assert.That(_failures.Failures, Is.Empty);
        Assert.That(
            await _service.ResetAsync(new ResetPasswordCommand(token, "another password")),
            Is.EqualTo(new ResetPasswordResult.Unavailable(ResetLinkProblem.Used)));
    }

    [TestCase(null, "required")]
    [TestCase("", "required")]
    [TestCase("short", "tooShort")]
    public async Task Reset_with_an_invalid_password_changes_nothing(string? password, string code)
    {
        var token = await CreateLinkAsync();
        AddSession(_ben);

        var result = await _service.ResetAsync(new ResetPasswordCommand(token, password));

        Assert.That(((ResetPasswordResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["password"] = code }));
        Assert.That(_ben.PasswordHash, Is.EqualTo("hashed:old password"));
        Assert.That(_resets.Tokens.Single().UsedAt, Is.Null);
        Assert.That(_sessions.Sessions, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Reset_checks_the_link_before_the_password()
    {
        Assert.That(
            await _service.ResetAsync(new ResetPasswordCommand("not-a-token", "")),
            Is.EqualTo(new ResetPasswordResult.Unavailable(ResetLinkProblem.Unknown)));
    }

    [Test]
    public async Task Reset_with_an_expired_link_is_refused()
    {
        var token = await CreateLinkAsync();
        _time.Now = Now + PasswordResetPolicy.AdminLinkLifetime;

        Assert.That(
            await _service.ResetAsync(new ResetPasswordCommand(token, "new password")),
            Is.EqualTo(new ResetPasswordResult.Unavailable(ResetLinkProblem.Expired)));
        Assert.That(_ben.PasswordHash, Is.EqualTo("hashed:old password"));
    }

    [Test]
    public async Task Reset_losing_the_race_for_the_link_is_used_and_changes_nothing()
    {
        var token = await CreateLinkAsync();
        _resets.ConsumedConcurrently = true;

        Assert.That(
            await _service.ResetAsync(new ResetPasswordCommand(token, "new password")),
            Is.EqualTo(new ResetPasswordResult.Unavailable(ResetLinkProblem.Used)));
        Assert.That(_ben.PasswordHash, Is.EqualTo("hashed:old password"));
        Assert.That(_users.Updates, Is.Zero);
    }

    [Test]
    public async Task Request_for_an_active_account_queues_one_email_with_a_one_hour_link()
    {
        var result = await RequestAsync();

        Assert.That(result, Is.InstanceOf<RequestResetResult.Requested>());
        var message = _outbox.Messages.Single();
        Assert.That(message.To, Is.EqualTo("ben@mail.com"));
        var stored = _resets.Tokens.Single();
        Assert.That(stored.UserId, Is.EqualTo(_ben.Id));
        Assert.That(stored.CreatedAt, Is.EqualTo(Now));
        Assert.That(stored.ExpiresAt, Is.EqualTo(Now + TimeSpan.FromHours(1)));
        Assert.That(stored.TokenHash, Is.EqualTo(LinkToken.Hash(EmailedToken())));
    }

    [Test]
    public async Task Request_normalizes_the_email()
    {
        await RequestAsync(" Ben@Mail.com ");

        Assert.That(_outbox.Messages.Single().To, Is.EqualTo("ben@mail.com"));
    }

    [Test]
    public async Task Emailed_link_resets_the_password()
    {
        await RequestAsync();

        var result = await _service.ResetAsync(new ResetPasswordCommand(EmailedToken(), "new password"));

        Assert.That(result, Is.EqualTo(new ResetPasswordResult.Reset(_ben)));
        Assert.That(_ben.PasswordHash, Is.EqualTo("hashed:new password"));
    }

    [TestCase("unknown")]
    [TestCase("deleted")]
    public async Task Request_for_an_unknown_or_deleted_account_sends_nothing_and_succeeds(string account)
    {
        switch (account)
        {
            case "deleted":
                _ben.DeletedAt = Now;
                _ben.Email = null;
                break;
        }

        var result = await RequestAsync(account == "unknown" ? "nobody@mail.com" : "ben@mail.com");

        Assert.That(result, Is.InstanceOf<RequestResetResult.Requested>());
        Assert.That(_outbox.Messages, Is.Empty);
        Assert.That(_resets.Tokens, Is.Empty);
    }

    [Test]
    public async Task Request_within_5_minutes_of_the_newest_link_sends_nothing()
    {
        await CreateLinkAsync();
        _time.Now = Now + TimeSpan.FromMinutes(5) - TimeSpan.FromSeconds(1);

        var result = await RequestAsync();

        Assert.That(result, Is.InstanceOf<RequestResetResult.Requested>());
        Assert.That(_outbox.Messages, Is.Empty);
        Assert.That(_resets.Tokens, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Request_5_minutes_after_the_newest_link_sends_again()
    {
        await RequestAsync();
        _time.Now = Now + TimeSpan.FromMinutes(5);

        await RequestAsync();

        Assert.That(_outbox.Messages, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task Emailed_link_replaces_the_earlier_unused_ones()
    {
        var adminLink = await CreateLinkAsync();
        _time.Now = Now + TimeSpan.FromMinutes(10);

        await RequestAsync();

        Assert.That(await _service.LookupAsync(adminLink), Is.EqualTo(new ResetLinkLookup.Unavailable(ResetLinkProblem.Unknown)));
        Assert.That(await _service.LookupAsync(EmailedToken()), Is.InstanceOf<ResetLinkLookup.Valid>());
    }

    [TestCase(null, "required")]
    [TestCase("  ", "required")]
    [TestCase("ben", "invalid")]
    public async Task Missing_or_malformed_email_is_invalid(string? email, string code)
    {
        var result = await RequestAsync(email);

        Assert.That(((RequestResetResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["email"] = code }));
        Assert.That(_outbox.Messages, Is.Empty);
    }

    [Test]
    public async Task Email_is_in_the_users_language()
    {
        _ben.PreferredLanguage = "fr";

        await RequestAsync();

        Assert.That(_outbox.Messages.Single().Subject, Is.EqualTo("Réinitialiser votre mot de passe Nala"));
    }
}
