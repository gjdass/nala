using Nala.Core.Auth;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class SetupServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private SetupService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _service = new SetupService(_users, new FakePasswordHasher(), new FixedTimeProvider(Now));
    }

    private static SetupCommand Valid() => new("Anna@Mail.com ", " Anna ", "correct horse", "fr");

    [Test]
    public async Task Creates_admin_with_normalized_email_and_hashed_password()
    {
        var result = await _service.SetupAsync(Valid());

        Assert.That(result, Is.InstanceOf<SetupResult.Created>());
        var user = _users.Users.Single();
        Assert.That(((SetupResult.Created)result).User, Is.SameAs(user));
        Assert.That(user.IsAdmin, Is.True);
        Assert.That(user.IsDisabled, Is.False);
        Assert.That(user.Email, Is.EqualTo("anna@mail.com"));
        Assert.That(user.DisplayName, Is.EqualTo("Anna"));
        Assert.That(user.PasswordHash, Is.EqualTo("hashed:correct horse"));
        Assert.That(user.PreferredLanguage, Is.EqualTo("fr"));
        Assert.That(user.CreatedAt, Is.EqualTo(Now));
        Assert.That(user.Id, Is.Not.EqualTo(Guid.Empty));
    }

    [TestCase(null)]
    [TestCase("de")]
    public async Task Unsupported_language_falls_back_to_english(string? language)
    {
        await _service.SetupAsync(Valid() with { Language = language });

        Assert.That(_users.Users.Single().PreferredLanguage, Is.EqualTo("en"));
    }

    [Test]
    public async Task Refused_when_any_user_exists()
    {
        await _service.SetupAsync(Valid());

        var result = await _service.SetupAsync(Valid() with { Email = "other@mail.com" });

        Assert.That(result, Is.InstanceOf<SetupResult.AlreadySetUp>());
        Assert.That(_users.Users, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Refused_when_any_user_exists_even_with_invalid_input()
    {
        await _service.SetupAsync(Valid());

        var result = await _service.SetupAsync(new SetupCommand(null, null, null, null));

        Assert.That(result, Is.InstanceOf<SetupResult.AlreadySetUp>());
    }

    [Test]
    public async Task Conflict_on_save_returns_already_set_up()
    {
        _users.ConflictOnAdd = true;

        var result = await _service.SetupAsync(Valid());

        Assert.That(result, Is.InstanceOf<SetupResult.AlreadySetUp>());
    }

    [Test]
    public async Task Invalid_input_returns_field_errors()
    {
        var result = await _service.SetupAsync(new SetupCommand("anna@localhost", new string('a', 51), "short", "en"));

        Assert.That(result, Is.InstanceOf<SetupResult.Invalid>());
        Assert.That(((SetupResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "invalid",
            ["displayName"] = "tooLong",
            ["password"] = "tooShort",
        }));
        Assert.That(_users.Users, Is.Empty);
    }

    [Test]
    public async Task Missing_fields_are_required()
    {
        var result = await _service.SetupAsync(new SetupCommand(" ", null, "", "en"));

        Assert.That(((SetupResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "required",
            ["displayName"] = "required",
            ["password"] = "required",
        }));
    }
}
