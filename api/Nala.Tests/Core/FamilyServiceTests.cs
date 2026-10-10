using Nala.Core.Families;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class FamilyServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 10, 12, 0, 0, TimeSpan.Zero);

    private static User NewUser(string name) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name.ToLowerInvariant()}@mail.com",
        DisplayName = name,
        PreferredLanguage = "en",
    };

    private static FamilyService NewService(FakeFamilyRepository families) =>
        new(families, new FamilyAccess(families, new FakeBabyRepository(families)));

    [Test]
    public async Task List_returns_the_users_families_with_their_role_by_name_then_creation()
    {
        var families = new FakeFamilyRepository();
        var anna = NewUser("Anna");
        var ben = NewUser("Ben");
        var zoe = families.Seed("zoe's", Now, anna);
        var secondMartins = families.Seed("Martins", Now.AddDays(1), ben, anna);
        var firstMartins = families.Seed("martins", Now, anna);
        families.Seed("Ben only", Now, ben);

        var listed = await NewService(families).ListAsync(anna);

        Assert.That(listed, Is.EqualTo(new[]
        {
            new UserFamily(firstMartins, FamilyRole.Admin),
            new UserFamily(secondMartins, FamilyRole.Member),
            new UserFamily(zoe, FamilyRole.Admin),
        }));
    }

    [Test]
    public async Task Rename_by_the_family_admin_saves_the_trimmed_name()
    {
        var families = new FakeFamilyRepository();
        var anna = NewUser("Anna");
        var martins = families.Seed("Martins", Now, anna);

        var result = await NewService(families).RenameAsync(anna, martins.Id, "  The Martins  ");

        Assert.That(result, Is.EqualTo(new RenameFamilyResult.Renamed(new UserFamily(martins, FamilyRole.Admin))));
        Assert.That(families.Families.Single().Name, Is.EqualTo("The Martins"));
    }

    [TestCase("The Martins")]
    [TestCase("")]
    public async Task Rename_by_a_member_is_forbidden_before_the_fields_and_changes_nothing(string name)
    {
        var families = new FakeFamilyRepository();
        var anna = NewUser("Anna");
        var ben = NewUser("Ben");
        families.Seed("Martins", Now, anna, ben);

        var result = await NewService(families).RenameAsync(ben, families.Families.Single().Id, name);

        Assert.That(result, Is.InstanceOf<RenameFamilyResult.Forbidden>());
        Assert.That(families.Families.Single().Name, Is.EqualTo("Martins"));
    }

    [TestCase("The Martins")]
    [TestCase("")]
    public async Task Rename_of_another_familys_or_an_unknown_family_is_not_found_before_the_role_and_fields(string name)
    {
        var families = new FakeFamilyRepository();
        var anna = NewUser("Anna");
        var carl = NewUser("Carl");
        families.Seed("Martins", Now, anna);
        var others = families.Seed("Others", Now, carl);
        var service = NewService(families);

        Assert.That(await service.RenameAsync(anna, others.Id, name), Is.InstanceOf<RenameFamilyResult.NotFound>());
        Assert.That(await service.RenameAsync(anna, Guid.NewGuid(), name), Is.InstanceOf<RenameFamilyResult.NotFound>());
        Assert.That(others.Name, Is.EqualTo("Others"));
    }

    [TestCase(null, "required")]
    [TestCase("   ", "required")]
    [TestCase("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "tooLong")]
    public async Task Rename_with_an_invalid_name_returns_the_code(string? name, string code)
    {
        var families = new FakeFamilyRepository();
        var anna = NewUser("Anna");
        var martins = families.Seed("Martins", Now, anna);

        var result = await NewService(families).RenameAsync(anna, martins.Id, name);

        Assert.That(result, Is.InstanceOf<RenameFamilyResult.Invalid>());
        Assert.That(((RenameFamilyResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["name"] = code }));
        Assert.That(martins.Name, Is.EqualTo("Martins"));
    }
}
