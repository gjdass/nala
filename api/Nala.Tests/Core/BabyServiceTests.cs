using Nala.Core.Babies;
using Nala.Core.Families;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class BabyServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Now.AddHours(3);

    private FakeBabyRepository _babies = null!;
    private FakeFamilyRepository _families = null!;
    private BabyService _service = null!;

    // Anna administers the Martins, Ben is a member; Carl administers another family.
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
        _service = NewService(Now);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _carl = NewUser("Carl");
        _martins = _families.Seed("Martins", Now, _anna, _ben);
        _others = _families.Seed("Others", Now, _carl);
    }

    private BabyService NewService(DateTimeOffset now) =>
        new(_babies, new FamilyAccess(_families, _babies), new FixedTimeProvider(now));

    private static User NewUser(string name, bool isAdmin = false) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name.ToLowerInvariant()}@mail.com",
        DisplayName = name,
        PreferredLanguage = "en",
        IsAdmin = isAdmin,
    };

    private static BabyInput Lea => new("Lea", new DateOnly(2026, 9, 1), null, null, null, null);

    /// <summary>A baby of <paramref name="family"/> added by <paramref name="creator"/> at <see cref="Now"/>, with every field set.</summary>
    private async Task<Baby> AddLeaAsync(User creator, Family family)
    {
        var result = await _service.CreateAsync(
            creator, family.Id, new BabyInput("Lea", new DateOnly(2026, 9, 1), "girl", 3400, 50.5m, 34.5m));
        _service = NewService(Later);
        return ((CreateBabyResult.Created)result).Baby;
    }

    [Test]
    public async Task A_new_baby_goes_to_the_given_family()
    {
        var result = await _service.CreateAsync(_ben, _martins.Id, Lea);

        Assert.That(((CreateBabyResult.Created)result).Baby.FamilyId, Is.EqualTo(_martins.Id));
    }

    [Test]
    public async Task Any_member_can_add_a_baby()
    {
        var result = await _service.CreateAsync(
            _ben, _martins.Id, new BabyInput("  Lea ", new DateOnly(2026, 9, 1), "girl", 3400, 50.5m, 34.5m));

        var baby = ((CreateBabyResult.Created)result).Baby;
        Assert.That(_babies.Babies, Is.EqualTo(new[] { baby }));
        Assert.Multiple(() =>
        {
            Assert.That(baby.Id, Is.Not.EqualTo(Guid.Empty));
            Assert.That(baby.Name, Is.EqualTo("Lea"));
            Assert.That(baby.BirthDate, Is.EqualTo(new DateOnly(2026, 9, 1)));
            Assert.That(baby.Sex, Is.EqualTo(Sex.Girl));
            Assert.That(baby.BirthWeightG, Is.EqualTo(3400));
            Assert.That(baby.BirthLengthCm, Is.EqualTo(50.5m));
            Assert.That(baby.BirthHeadCircumferenceCm, Is.EqualTo(34.5m));
            Assert.That(baby.CreatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(baby.CreatedAt, Is.EqualTo(Now));
            Assert.That(baby.UpdatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Adding_to_another_family_is_family_not_found()
    {
        var result = await _service.CreateAsync(_anna, _others.Id, Lea);

        Assert.That(result, Is.InstanceOf<CreateBabyResult.FamilyNotFound>());
        Assert.That(_babies.Babies, Is.Empty);
    }

    [Test]
    public async Task Adding_to_an_unknown_family_is_family_not_found_before_the_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), new BabyInput("", null, null, null, null, null));

        Assert.That(result, Is.InstanceOf<CreateBabyResult.FamilyNotFound>());
    }

    [Test]
    public async Task A_missing_family_is_a_required_field()
    {
        var result = await _service.CreateAsync(_anna, null, new BabyInput("", new DateOnly(2026, 9, 1), null, null, null, null));

        var errors = ((CreateBabyResult.Invalid)result).Errors;
        Assert.That(errors["familyId"], Is.EqualTo("required"));
        Assert.That(errors["name"], Is.EqualTo("required"));
        Assert.That(_babies.Babies, Is.Empty);
    }

    [Test]
    public async Task Sex_defaults_to_unspecified_and_measurements_are_optional()
    {
        var result = await _service.CreateAsync(_anna, _martins.Id, Lea);

        var baby = ((CreateBabyResult.Created)result).Baby;
        Assert.That(baby.Sex, Is.EqualTo(Sex.Unspecified));
        Assert.That(baby.BirthWeightG, Is.Null);
        Assert.That(baby.BirthLengthCm, Is.Null);
        Assert.That(baby.BirthHeadCircumferenceCm, Is.Null);
    }

    [Test]
    public async Task Invalid_input_saves_nothing()
    {
        var result = await _service.CreateAsync(_anna, _martins.Id, new BabyInput("", new DateOnly(2030, 1, 1), null, null, null, null));

        Assert.That(((CreateBabyResult.Invalid)result).Errors, Does.ContainKey("name").And.ContainKey("birthDate"));
        Assert.That(_babies.Babies, Is.Empty);
    }

    [Test]
    public async Task List_returns_only_the_callers_families_babies_in_the_repository_order()
    {
        await _service.CreateAsync(_anna, _martins.Id, Lea);
        await _service.CreateAsync(_ben, _martins.Id, new BabyInput("Tom", new DateOnly(2024, 3, 1), null, null, null, null));
        await _service.CreateAsync(_carl, _others.Id, new BabyInput("Zoe", new DateOnly(2025, 1, 1), null, null, null, null));

        Assert.Multiple(async () =>
        {
            Assert.That((await _service.ListAsync(_ben)).Select(b => b.Name), Is.EqualTo(new[] { "Tom", "Lea" }));
            Assert.That((await _service.ListAsync(_carl)).Select(b => b.Name), Is.EqualTo(new[] { "Zoe" }));
        });
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Any_member_can_edit_every_field_of_any_baby_of_the_family(bool byAdmin)
    {
        var lea = await AddLeaAsync(_ben, _martins);

        var result = await _service.UpdateAsync(
            byAdmin ? _anna : _ben, lea.Id, new BabyInput("  Léa ", new DateOnly(2026, 8, 31), "boy", 3500, 51m, 35m));

        var baby = ((UpdateBabyResult.Updated)result).Baby;
        var stored = _babies.Babies.Single();
        Assert.Multiple(() =>
        {
            Assert.That(baby.Id, Is.EqualTo(lea.Id));
            Assert.That(stored.FamilyId, Is.EqualTo(_martins.Id));
            Assert.That(stored.Name, Is.EqualTo("Léa"));
            Assert.That(stored.BirthDate, Is.EqualTo(new DateOnly(2026, 8, 31)));
            Assert.That(stored.Sex, Is.EqualTo(Sex.Boy));
            Assert.That(stored.BirthWeightG, Is.EqualTo(3500));
            Assert.That(stored.BirthLengthCm, Is.EqualTo(51m));
            Assert.That(stored.BirthHeadCircumferenceCm, Is.EqualTo(35m));
            Assert.That(stored.CreatedByUserId, Is.EqualTo(_ben.Id));
            Assert.That(stored.CreatedAt, Is.EqualTo(Now));
            Assert.That(stored.UpdatedAt, Is.EqualTo(Later));
        });
    }

    [Test]
    public async Task Edit_replaces_every_field_so_omitted_ones_are_cleared()
    {
        var lea = await AddLeaAsync(_anna, _martins);

        await _service.UpdateAsync(_ben, lea.Id, Lea);

        var stored = _babies.Babies.Single();
        Assert.That(stored.Sex, Is.EqualTo(Sex.Unspecified));
        Assert.That(stored.BirthWeightG, Is.Null);
        Assert.That(stored.BirthLengthCm, Is.Null);
        Assert.That(stored.BirthHeadCircumferenceCm, Is.Null);
    }

    [Test]
    public async Task Invalid_edit_changes_nothing()
    {
        var lea = await AddLeaAsync(_anna, _martins);

        var result = await _service.UpdateAsync(
            _ben, lea.Id, new BabyInput(" ", new DateOnly(2030, 1, 1), null, 100, null, null));

        Assert.That(((UpdateBabyResult.Invalid)result).Errors, Does.ContainKey("name").And.ContainKey("birthDate").And.ContainKey("birthWeightG"));
        var stored = _babies.Babies.Single();
        Assert.That(stored.Name, Is.EqualTo("Lea"));
        Assert.That(stored.BirthWeightG, Is.EqualTo(3400));
        Assert.That(stored.UpdatedAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Editing_an_unknown_baby_is_not_found()
    {
        var result = await _service.UpdateAsync(_anna, Guid.NewGuid(), Lea);

        Assert.That(result, Is.InstanceOf<UpdateBabyResult.NotFound>());
    }

    [Test]
    public async Task Editing_another_familys_baby_is_not_found_and_changes_nothing()
    {
        var zoe = await AddLeaAsync(_carl, _others);

        var result = await _service.UpdateAsync(_anna, zoe.Id, new BabyInput("", null, null, null, null, null));

        Assert.That(result, Is.InstanceOf<UpdateBabyResult.NotFound>());
        Assert.That(_babies.Babies.Single().UpdatedAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task The_family_admin_deletes_a_baby()
    {
        var lea = await AddLeaAsync(_ben, _martins);

        var result = await _service.DeleteAsync(_anna, lea.Id);

        Assert.That(result, Is.InstanceOf<DeleteBabyResult.Deleted>());
        Assert.That(_babies.Babies, Is.Empty);
    }

    [Test]
    public async Task A_member_cannot_delete_a_baby_even_as_instance_admin()
    {
        var instanceAdmin = NewUser("Ida", isAdmin: true);
        _families.Memberships.Add(new Membership { FamilyId = _martins.Id, UserId = instanceAdmin.Id, Role = FamilyRole.Member, JoinedAt = Now });
        var lea = await AddLeaAsync(_anna, _martins);

        Assert.Multiple(async () =>
        {
            Assert.That(await _service.DeleteAsync(_ben, lea.Id), Is.InstanceOf<DeleteBabyResult.Forbidden>());
            Assert.That(await _service.DeleteAsync(instanceAdmin, lea.Id), Is.InstanceOf<DeleteBabyResult.Forbidden>());
        });
        Assert.That(_babies.Babies, Is.EqualTo(new[] { lea }));
    }

    [Test]
    public async Task Deleting_an_unknown_baby_is_not_found()
    {
        var result = await _service.DeleteAsync(_ben, Guid.NewGuid());

        Assert.That(result, Is.InstanceOf<DeleteBabyResult.NotFound>());
    }

    [Test]
    public async Task Deleting_another_familys_baby_is_not_found_before_the_role_check()
    {
        var zoe = await AddLeaAsync(_carl, _others);

        Assert.Multiple(async () =>
        {
            Assert.That(await _service.DeleteAsync(_anna, zoe.Id), Is.InstanceOf<DeleteBabyResult.NotFound>());
            Assert.That(await _service.DeleteAsync(_ben, zoe.Id), Is.InstanceOf<DeleteBabyResult.NotFound>());
        });
        Assert.That(_babies.Babies, Is.EqualTo(new[] { zoe }));
    }
}
