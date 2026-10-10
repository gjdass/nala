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

        var listed = await new FamilyService(families).ListAsync(anna);

        Assert.That(listed, Is.EqualTo(new[]
        {
            new UserFamily(firstMartins, FamilyRole.Admin),
            new UserFamily(secondMartins, FamilyRole.Member),
            new UserFamily(zoe, FamilyRole.Admin),
        }));
    }
}
