using Nala.Core.Babies;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class BabyServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeBabyRepository _babies = null!;
    private BabyService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _babies = new FakeBabyRepository();
        _service = new BabyService(_babies, new FixedTimeProvider(Now));
    }

    private static User NewUser(bool isAdmin = false) => new()
    {
        Id = Guid.NewGuid(),
        Email = "someone@mail.com",
        DisplayName = "Someone",
        PreferredLanguage = "en",
        IsAdmin = isAdmin,
    };

    [TestCase(true)]
    [TestCase(false)]
    public async Task Any_member_can_add_a_baby(bool isAdmin)
    {
        var actor = NewUser(isAdmin);

        var result = await _service.CreateAsync(
            actor, new BabyInput("  Lea ", new DateOnly(2026, 9, 1), "girl", 3400, 50.5m, 34.5m));

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
            Assert.That(baby.CreatedByUserId, Is.EqualTo(actor.Id));
            Assert.That(baby.CreatedAt, Is.EqualTo(Now));
            Assert.That(baby.UpdatedAt, Is.EqualTo(Now));
        });
    }

    [Test]
    public async Task Sex_defaults_to_unspecified_and_measurements_are_optional()
    {
        var result = await _service.CreateAsync(NewUser(), new BabyInput("Lea", new DateOnly(2026, 9, 1), null, null, null, null));

        var baby = ((CreateBabyResult.Created)result).Baby;
        Assert.That(baby.Sex, Is.EqualTo(Sex.Unspecified));
        Assert.That(baby.BirthWeightG, Is.Null);
        Assert.That(baby.BirthLengthCm, Is.Null);
        Assert.That(baby.BirthHeadCircumferenceCm, Is.Null);
    }

    [Test]
    public async Task Invalid_input_saves_nothing()
    {
        var result = await _service.CreateAsync(NewUser(), new BabyInput("", new DateOnly(2030, 1, 1), null, null, null, null));

        Assert.That(result, Is.InstanceOf<CreateBabyResult.Invalid>());
        Assert.That(((CreateBabyResult.Invalid)result).Errors, Does.ContainKey("name").And.ContainKey("birthDate"));
        Assert.That(_babies.Babies, Is.Empty);
    }

    [Test]
    public async Task List_returns_the_repository_order()
    {
        await _service.CreateAsync(NewUser(), new BabyInput("Lea", new DateOnly(2026, 9, 1), null, null, null, null));
        await _service.CreateAsync(NewUser(), new BabyInput("Tom", new DateOnly(2024, 3, 1), null, null, null, null));

        var list = await _service.ListAsync();

        Assert.That(list.Select(b => b.Name), Is.EqualTo(new[] { "Tom", "Lea" }));
    }

    private static readonly DateTimeOffset Later = Now.AddHours(3);

    /// <summary>A baby added by <paramref name="creator"/> at <see cref="Now"/>, with every field set.</summary>
    private async Task<Baby> AddLeaAsync(User creator)
    {
        var result = await _service.CreateAsync(
            creator, new BabyInput("Lea", new DateOnly(2026, 9, 1), "girl", 3400, 50.5m, 34.5m));
        _service = new BabyService(_babies, new FixedTimeProvider(Later));
        return ((CreateBabyResult.Created)result).Baby;
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Any_member_can_edit_every_field_of_any_baby(bool isAdmin)
    {
        var creator = NewUser();
        var lea = await AddLeaAsync(creator);

        var result = await _service.UpdateAsync(
            NewUser(isAdmin), lea.Id, new BabyInput("  Léa ", new DateOnly(2026, 8, 31), "boy", 3500, 51m, 35m));

        var baby = ((UpdateBabyResult.Updated)result).Baby;
        var stored = _babies.Babies.Single();
        Assert.Multiple(() =>
        {
            Assert.That(baby.Id, Is.EqualTo(lea.Id));
            Assert.That(stored.Name, Is.EqualTo("Léa"));
            Assert.That(stored.BirthDate, Is.EqualTo(new DateOnly(2026, 8, 31)));
            Assert.That(stored.Sex, Is.EqualTo(Sex.Boy));
            Assert.That(stored.BirthWeightG, Is.EqualTo(3500));
            Assert.That(stored.BirthLengthCm, Is.EqualTo(51m));
            Assert.That(stored.BirthHeadCircumferenceCm, Is.EqualTo(35m));
            Assert.That(stored.CreatedByUserId, Is.EqualTo(creator.Id));
            Assert.That(stored.CreatedAt, Is.EqualTo(Now));
            Assert.That(stored.UpdatedAt, Is.EqualTo(Later));
        });
    }

    [Test]
    public async Task Edit_replaces_every_field_so_omitted_ones_are_cleared()
    {
        var lea = await AddLeaAsync(NewUser());

        await _service.UpdateAsync(NewUser(), lea.Id, new BabyInput("Lea", new DateOnly(2026, 9, 1), null, null, null, null));

        var stored = _babies.Babies.Single();
        Assert.That(stored.Sex, Is.EqualTo(Sex.Unspecified));
        Assert.That(stored.BirthWeightG, Is.Null);
        Assert.That(stored.BirthLengthCm, Is.Null);
        Assert.That(stored.BirthHeadCircumferenceCm, Is.Null);
    }

    [Test]
    public async Task Invalid_edit_changes_nothing()
    {
        var lea = await AddLeaAsync(NewUser());

        var result = await _service.UpdateAsync(
            NewUser(), lea.Id, new BabyInput(" ", new DateOnly(2030, 1, 1), null, 100, null, null));

        Assert.That(((UpdateBabyResult.Invalid)result).Errors, Does.ContainKey("name").And.ContainKey("birthDate").And.ContainKey("birthWeightG"));
        var stored = _babies.Babies.Single();
        Assert.That(stored.Name, Is.EqualTo("Lea"));
        Assert.That(stored.BirthWeightG, Is.EqualTo(3400));
        Assert.That(stored.UpdatedAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Editing_an_unknown_baby_is_not_found()
    {
        var result = await _service.UpdateAsync(NewUser(), Guid.NewGuid(), new BabyInput("Lea", new DateOnly(2026, 9, 1), null, null, null, null));

        Assert.That(result, Is.InstanceOf<UpdateBabyResult.NotFound>());
    }

    [Test]
    public async Task The_admin_deletes_a_baby()
    {
        var lea = await AddLeaAsync(NewUser());

        var result = await _service.DeleteAsync(NewUser(isAdmin: true), lea.Id);

        Assert.That(result, Is.InstanceOf<DeleteBabyResult.Deleted>());
        Assert.That(_babies.Babies, Is.Empty);
    }

    [Test]
    public async Task A_member_cannot_delete_a_baby()
    {
        var lea = await AddLeaAsync(NewUser());

        var result = await _service.DeleteAsync(NewUser(), lea.Id);

        Assert.That(result, Is.InstanceOf<DeleteBabyResult.Forbidden>());
        Assert.That(_babies.Babies, Is.EqualTo(new[] { lea }));
    }

    [Test]
    public async Task Deleting_an_unknown_baby_is_not_found()
    {
        var result = await _service.DeleteAsync(NewUser(isAdmin: true), Guid.NewGuid());

        Assert.That(result, Is.InstanceOf<DeleteBabyResult.NotFound>());
    }

    [Test]
    public async Task A_member_deleting_an_unknown_baby_is_refused_before_the_lookup()
    {
        var result = await _service.DeleteAsync(NewUser(), Guid.NewGuid());

        Assert.That(result, Is.InstanceOf<DeleteBabyResult.Forbidden>());
    }
}
