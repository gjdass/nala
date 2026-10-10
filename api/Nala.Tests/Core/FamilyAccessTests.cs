using Nala.Core.Babies;
using Nala.Core.Families;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class FamilyAccessTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeFamilyRepository _families = null!;
    private FakeBabyRepository _babies = null!;
    private FamilyAccess _access = null!;
    private User _anna = null!;
    private User _ben = null!;
    private User _carl = null!;
    private Family _martins = null!;
    private Family _others = null!;

    [SetUp]
    public void SetUp()
    {
        _families = new FakeFamilyRepository();
        _babies = new FakeBabyRepository(_families);
        _access = new FamilyAccess(_families, _babies);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _carl = NewUser("Carl");
        _martins = _families.Seed("Martins", Now, _anna, _ben);
        _others = _families.Seed("Others", Now, _carl);
    }

    private static User NewUser(string name) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name.ToLowerInvariant()}@mail.com",
        DisplayName = name,
        PreferredLanguage = "en",
    };

    private Baby AddBaby(Family family)
    {
        var baby = new Baby { Id = Guid.NewGuid(), FamilyId = family.Id, Name = "Lea", BirthDate = new DateOnly(2026, 9, 1) };
        _babies.Babies.Add(baby);
        return baby;
    }

    [Test]
    public async Task RoleIn_returns_the_callers_role()
    {
        Assert.Multiple(async () =>
        {
            Assert.That(await _access.RoleInAsync(_anna, _martins.Id), Is.EqualTo(FamilyRole.Admin));
            Assert.That(await _access.RoleInAsync(_ben, _martins.Id), Is.EqualTo(FamilyRole.Member));
        });
    }

    [Test]
    public async Task RoleIn_is_null_outside_the_callers_families()
    {
        Assert.Multiple(async () =>
        {
            Assert.That(await _access.RoleInAsync(_anna, _others.Id), Is.Null);
            Assert.That(await _access.RoleInAsync(_anna, Guid.NewGuid()), Is.Null);
        });
    }

    [Test]
    public async Task ForBaby_returns_the_baby_and_the_callers_role()
    {
        var lea = AddBaby(_martins);

        var access = await _access.ForBabyAsync(_ben, lea.Id);

        Assert.That(access, Is.EqualTo(new BabyAccess(lea, FamilyRole.Member)));
    }

    [Test]
    public async Task ForBaby_is_null_for_another_familys_baby_as_for_an_unknown_one()
    {
        var zoe = AddBaby(_others);

        Assert.Multiple(async () =>
        {
            Assert.That(await _access.ForBabyAsync(_anna, zoe.Id), Is.Null);
            Assert.That(await _access.ForBabyAsync(_anna, Guid.NewGuid()), Is.Null);
        });
    }

    [Test]
    public async Task ReachesBaby_only_for_the_babies_of_the_callers_families()
    {
        var lea = AddBaby(_martins);
        var max = AddBaby(_others);

        Assert.That(await _access.ReachesBabyAsync(_ben, lea.Id), Is.True);
        Assert.That(await _access.ReachesBabyAsync(_ben, max.Id), Is.False);
        Assert.That(await _access.ReachesBabyAsync(_ben, Guid.NewGuid()), Is.False);
    }

    [Test]
    public async Task BabyIds_are_the_babies_of_the_callers_families()
    {
        var lea = AddBaby(_martins);
        AddBaby(_others);
        var tom = AddBaby(_families.Seed("Grandparents", Now, _carl, _anna));

        Assert.That(await _access.BabyIdsAsync(_anna), Is.EquivalentTo(new[] { lea.Id, tom.Id }));
        Assert.That(await _access.BabyIdsAsync(_ben), Is.EqualTo(new[] { lea.Id }));
    }
}
