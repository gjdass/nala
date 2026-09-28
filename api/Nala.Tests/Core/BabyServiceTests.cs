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
}
