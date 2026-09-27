using Nala.Core.Auth;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class LoginServiceTests
{
    private const string Password = "correct horse";

    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakePasswordHasher _hasher = null!;
    private FakeLoginFailureRepository _failures = null!;
    private FixedTimeProvider _time = null!;
    private LoginService _service = null!;
    private User _anna = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _hasher = new FakePasswordHasher();
        _failures = new FakeLoginFailureRepository();
        _time = new FixedTimeProvider(Now);
        _service = new LoginService(_users, _hasher, _failures, _time);
        _anna = new User
        {
            Id = Guid.NewGuid(),
            Email = "anna@mail.com",
            DisplayName = "Anna",
            PasswordHash = $"hashed:{Password}",
            PreferredLanguage = "en",
        };
        _users.Users.Add(_anna);
    }

    private Task<LoginResult> LoginAsync(string? email = "anna@mail.com", string? password = Password) =>
        _service.LoginAsync(new LoginCommand(email, password));

    private async Task FailAsync(int times, string email = "anna@mail.com")
    {
        for (var i = 0; i < times; i++)
        {
            await LoginAsync(email, "wrong password");
        }
    }

    [Test]
    public async Task Correct_credentials_return_the_user()
    {
        var result = await LoginAsync(" Anna@Mail.com ");

        Assert.That(result, Is.EqualTo(new LoginResult.Success(_anna)));
    }

    [Test]
    public async Task Wrong_password_and_unknown_email_give_the_same_result()
    {
        Assert.That(await LoginAsync(password: "wrong password"), Is.InstanceOf<LoginResult.InvalidCredentials>());
        Assert.That(await LoginAsync(email: "nobody@mail.com"), Is.InstanceOf<LoginResult.InvalidCredentials>());
        Assert.That(await LoginAsync(email: "not an email"), Is.InstanceOf<LoginResult.InvalidCredentials>());
    }

    [Test]
    public async Task Unknown_email_still_runs_the_hasher()
    {
        await LoginAsync(email: "nobody@mail.com");

        Assert.That(_hasher.Calls, Is.EqualTo(1));
    }

    [Test]
    public async Task Deleted_user_cannot_log_in()
    {
        _anna.DeletedAt = Now;

        Assert.That(await LoginAsync(), Is.InstanceOf<LoginResult.InvalidCredentials>());
    }

    [Test]
    public async Task Disabled_account_with_the_right_password_is_refused_as_disabled()
    {
        _anna.IsDisabled = true;

        Assert.That(await LoginAsync(), Is.InstanceOf<LoginResult.AccountDisabled>());
        Assert.That(_failures.Failures, Is.Empty, "not counted as a failure");
    }

    [Test]
    public async Task Disabled_account_with_a_wrong_password_gets_the_generic_error()
    {
        _anna.IsDisabled = true;

        Assert.That(await LoginAsync(password: "wrong password"), Is.InstanceOf<LoginResult.InvalidCredentials>());
    }

    [Test]
    public async Task Missing_fields_are_required()
    {
        var result = await LoginAsync(" ", "");

        Assert.That(((LoginResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "required",
            ["password"] = "required",
        }));
    }

    [Test]
    public async Task Wrong_password_records_a_failure_for_the_normalized_email()
    {
        await LoginAsync(" Anna@Mail.com", "wrong password");

        Assert.That(_failures.Failures, Is.EqualTo(new[] { ("anna@mail.com", Now) }));
    }

    [Test]
    public async Task Five_failures_in_15_minutes_lock_further_attempts()
    {
        await FailAsync(LoginThrottle.MaxFailures);
        var calls = _hasher.Calls;

        var result = await LoginAsync();

        Assert.That(result, Is.InstanceOf<LoginResult.LockedOut>());
        Assert.That(_hasher.Calls, Is.EqualTo(calls), "the password is not checked while locked");
        Assert.That(_failures.Failures, Has.Count.EqualTo(LoginThrottle.MaxFailures), "refused attempts are not recorded");
    }

    [Test]
    public async Task Four_failures_do_not_lock()
    {
        await FailAsync(LoginThrottle.MaxFailures - 1);

        Assert.That(await LoginAsync(), Is.InstanceOf<LoginResult.Success>());
    }

    [Test]
    public async Task Failures_older_than_15_minutes_do_not_count()
    {
        await FailAsync(LoginThrottle.MaxFailures);
        _time.Now = Now + LoginThrottle.Window;

        Assert.That(await LoginAsync(), Is.InstanceOf<LoginResult.Success>());
    }

    [Test]
    public async Task Lock_applies_to_unknown_emails_too()
    {
        await FailAsync(LoginThrottle.MaxFailures, "nobody@mail.com");

        Assert.That(await LoginAsync("nobody@mail.com"), Is.InstanceOf<LoginResult.LockedOut>());
        Assert.That(await LoginAsync(), Is.InstanceOf<LoginResult.Success>(), "other emails are not locked");
    }

    [Test]
    public async Task Successful_login_clears_failures()
    {
        await FailAsync(LoginThrottle.MaxFailures - 1);

        await LoginAsync();

        Assert.That(_failures.Failures, Is.Empty);
    }
}
