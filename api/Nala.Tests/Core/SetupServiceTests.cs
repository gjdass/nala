using Nala.Core.Auth;
using Nala.Core.Families;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class SetupServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeFamilyRepository _families = null!;
    private SetupService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _families = new FakeFamilyRepository(_users);
        _service = new SetupService(_users, _families, new FakePasswordHasher(), new FixedTimeProvider(Now));
    }

    private static SetupCommand Valid() => new("Anna@Mail.com ", " Anna ", "correct horse", "fr", " The Martins ");

    [Test]
    public async Task Creates_admin_with_normalized_email_and_hashed_password()
    {
        var result = await _service.SetupAsync(Valid());

        Assert.That(result, Is.InstanceOf<SetupResult.Created>());
        var user = _users.Users.Single();
        Assert.That(((SetupResult.Created)result).User, Is.SameAs(user));
        Assert.That(user.IsAdmin, Is.True);
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

        var result = await _service.SetupAsync(new SetupCommand(null, null, null, null, null));

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
        var result = await _service.SetupAsync(new SetupCommand("anna@localhost", new string('a', 51), "short", "en", new string('f', 51)));

        Assert.That(result, Is.InstanceOf<SetupResult.Invalid>());
        Assert.That(((SetupResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "invalid",
            ["displayName"] = "tooLong",
            ["password"] = "tooShort",
            ["familyName"] = "tooLong",
        }));
        Assert.That(_users.Users, Is.Empty);
        Assert.That(_families.Families, Is.Empty);
    }

    [Test]
    public async Task Missing_fields_are_required()
    {
        var result = await _service.SetupAsync(new SetupCommand(" ", null, "", "en", "  "));

        Assert.That(((SetupResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "required",
            ["displayName"] = "required",
            ["password"] = "required",
            ["familyName"] = "required",
        }));
    }

    [Test]
    public async Task Setup_creates_the_family_with_its_admin_membership()
    {
        var result = await _service.SetupAsync(Valid());

        var admin = ((SetupResult.Created)result).User;
        var family = _families.Families.Single();
        Assert.Multiple(() =>
        {
            Assert.That(family.Id, Is.Not.EqualTo(Guid.Empty));
            Assert.That(family.Name, Is.EqualTo("The Martins"));
            Assert.That(family.CreatedByUserId, Is.EqualTo(admin.Id));
            Assert.That(family.CreatedAt, Is.EqualTo(Now));
        });
        var membership = _families.Memberships.Single();
        Assert.That(
            new { membership.FamilyId, membership.UserId, membership.Role, membership.JoinedAt },
            Is.EqualTo(new { FamilyId = family.Id, UserId = admin.Id, Role = FamilyRole.Admin, JoinedAt = Now }));
    }

    [Test]
    public async Task Setup_refuses_only_an_invalid_family_name()
    {
        var result = await _service.SetupAsync(Valid() with { FamilyName = null });

        Assert.That(((SetupResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["familyName"] = "required",
        }));
        Assert.That(_users.Users, Is.Empty);
        Assert.That(_families.Families, Is.Empty);
    }
}
