using Nala.Core.Babies;
using Nala.Core.Entries;
using Nala.Core.Medications;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class MedicationServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private FakeMedicationRepository _medications = null!;
    private FakeBabyRepository _babies = null!;
    private FixedTimeProvider _time = null!;
    private MedicationService _service = null!;
    private User _anna = null!;
    private User _ben = null!;
    private Baby _lea = null!;

    [SetUp]
    public void SetUp()
    {
        _medications = new FakeMedicationRepository();
        _babies = new FakeBabyRepository();
        _time = new FixedTimeProvider(Now);
        _service = new MedicationService(_medications, _babies, _time);
        _anna = NewUser("Anna");
        _ben = NewUser("Ben");
        _lea = new Baby { Id = Guid.NewGuid(), Name = "Lea", BirthDate = new DateOnly(2026, 9, 1), CreatedAt = Now };
        _babies.Babies.Add(_lea);
    }

    private User NewUser(string name)
    {
        var user = new User { Id = Guid.NewGuid(), DisplayName = name, PreferredLanguage = "en" };
        _medications.Names[user.Id] = name;
        return user;
    }

    private static MedicationInput Medication(
        int minutesAgo = 10, string? name = "Paracetamol", decimal? amount = 2.5m, string? unit = "ml", string? notes = null) =>
        new(Now.AddMinutes(-minutesAgo), name, amount, unit, notes);

    private async Task<MedicationEntry> CreateAsync(User actor, MedicationInput input, Guid? id = null) =>
        ((CreateMedicationResult.Created)await _service.CreateAsync(actor, id ?? Guid.NewGuid(), _lea.Id, input)).Entry;

    [Test]
    public async Task Creating_a_dose_stores_it_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var entry = await CreateAsync(_anna, Medication(name: " Vitamin D ", amount: 4m, unit: "drops", notes: " morning "), id);

        var medication = _medications.Medications.Single();
        Assert.Multiple(() =>
        {
            Assert.That(entry.Medication, Is.SameAs(medication));
            Assert.That(medication.Id, Is.EqualTo(id));
            Assert.That(medication.BabyId, Is.EqualTo(_lea.Id));
            Assert.That(medication.Time, Is.EqualTo(Now.AddMinutes(-10)));
            Assert.That(medication.Name, Is.EqualTo("Vitamin D"));
            Assert.That(medication.Amount, Is.EqualTo(4m));
            Assert.That(medication.Unit, Is.EqualTo(MedicationUnit.Drops));
            Assert.That(medication.Notes, Is.EqualTo("morning"));
            Assert.That(medication.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(medication.UpdatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(medication.CreatedAt, Is.EqualTo(Now));
            Assert.That(medication.UpdatedAt, Is.EqualTo(Now));
            Assert.That(entry.LoggedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
            Assert.That(entry.UpdatedBy, Is.EqualTo(new UserName(_anna.Id, "Anna")));
        });
    }

    [Test]
    public async Task The_unit_is_dropped_without_an_amount()
    {
        var created = await CreateAsync(_anna, Medication(amount: null, unit: "mg"));
        Assert.That((created.Medication.Amount, created.Medication.Unit), Is.EqualTo(((decimal?)null, (MedicationUnit?)null)));

        var result = await _service.UpdateAsync(_ben, created.Medication.Id, Medication(amount: null, unit: "drops"));

        var updated = ((UpdateMedicationResult.Updated)result).Entry.Medication;
        Assert.That(updated.Unit, Is.Null);
    }

    [Test]
    public async Task Blank_notes_are_stored_as_none()
    {
        var entry = await CreateAsync(_anna, Medication(notes: "   "));

        Assert.That(entry.Medication.Notes, Is.Null);
    }

    [Test]
    public async Task Resending_an_existing_id_returns_the_stored_dose_unchanged()
    {
        var id = Guid.NewGuid();
        await CreateAsync(_anna, Medication(name: "Paracetamol"), id);

        var result = await _service.CreateAsync(_ben, id, _lea.Id, Medication(minutesAgo: 2, name: "Ibuprofen"));

        var existing = (CreateMedicationResult.AlreadyExists)result;
        Assert.That(existing.Entry.Medication.Name, Is.EqualTo("Paracetamol"));
        Assert.That(_medications.Medications, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Creating_refuses_invalid_fields()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), _lea.Id, Medication(name: " ", unit: null));

        Assert.That(
            ((CreateMedicationResult.Invalid)result).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["name"] = "required", ["unit"] = "required" }));
        Assert.That(_medications.Medications, Is.Empty);
    }

    [Test]
    public async Task Creating_for_an_unknown_baby_is_refused()
    {
        var result = await _service.CreateAsync(_anna, Guid.NewGuid(), Guid.NewGuid(), Medication());

        Assert.That(result, Is.TypeOf<CreateMedicationResult.BabyNotFound>());
    }

    [Test]
    public async Task Any_member_updates_a_dose_and_the_update_records_who_and_when()
    {
        var created = await CreateAsync(_anna, Medication());
        _time.Now = Now.AddMinutes(5);

        var result = await _service.UpdateAsync(_ben, created.Medication.Id, Medication(minutesAgo: 20, name: "Ibuprofen", amount: 50m, unit: "mg", notes: "fever"));

        var updated = ((UpdateMedicationResult.Updated)result).Entry;
        Assert.Multiple(() =>
        {
            Assert.That(updated.Medication.Time, Is.EqualTo(Now.AddMinutes(-20)));
            Assert.That(updated.Medication.Name, Is.EqualTo("Ibuprofen"));
            Assert.That(updated.Medication.Amount, Is.EqualTo(50m));
            Assert.That(updated.Medication.Unit, Is.EqualTo(MedicationUnit.Mg));
            Assert.That(updated.Medication.Notes, Is.EqualTo("fever"));
            Assert.That(updated.Medication.LoggedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(updated.Medication.CreatedAt, Is.EqualTo(Now));
            Assert.That(updated.UpdatedBy, Is.EqualTo(new UserName(_ben.Id, "Ben")));
            Assert.That(updated.Medication.UpdatedAt, Is.EqualTo(Now.AddMinutes(5)));
        });
    }

    [Test]
    public async Task Updating_refuses_invalid_fields_and_keeps_the_dose()
    {
        var created = await CreateAsync(_anna, Medication());

        var result = await _service.UpdateAsync(_ben, created.Medication.Id, Medication(amount: 2000m));

        Assert.That(((UpdateMedicationResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["amount"] = "outOfRange" }));
        Assert.That(created.Medication.Amount, Is.EqualTo(2.5m));
    }

    [Test]
    public async Task Updating_an_unknown_dose_is_not_found() =>
        Assert.That(await _service.UpdateAsync(_anna, Guid.NewGuid(), Medication()), Is.TypeOf<UpdateMedicationResult.NotFound>());

    [Test]
    public async Task Deleting_removes_the_dose()
    {
        var created = await CreateAsync(_anna, Medication());

        Assert.That(await _service.DeleteAsync(created.Medication.Id), Is.TypeOf<DeleteMedicationResult.Deleted>());
        Assert.That(_medications.Medications, Is.Empty);
        Assert.That(await _service.DeleteAsync(created.Medication.Id), Is.TypeOf<DeleteMedicationResult.NotFound>());
    }

    [Test]
    public async Task A_dose_is_read_back_by_id()
    {
        var created = await CreateAsync(_anna, Medication());

        Assert.That((await _service.GetAsync(created.Medication.Id))?.Medication.Id, Is.EqualTo(created.Medication.Id));
        Assert.That(await _service.GetAsync(Guid.NewGuid()), Is.Null);
    }

    [Test]
    public async Task Pages_are_newest_first_with_a_cursor_to_the_next()
    {
        for (var i = 1; i <= 5; i++)
        {
            await CreateAsync(_anna, Medication(minutesAgo: i * 100));
        }

        var first = (ListMedicationsResult.Page)await _service.ListAsync(_lea.Id, null, 2);
        var second = (ListMedicationsResult.Page)await _service.ListAsync(_lea.Id, first.Next, 2);
        var last = (ListMedicationsResult.Page)await _service.ListAsync(_lea.Id, second.Next, 2);

        Assert.Multiple(() =>
        {
            Assert.That(first.Entries.Select(e => e.Medication.Time), Is.EqualTo(new[] { Now.AddMinutes(-100), Now.AddMinutes(-200) }));
            Assert.That(second.Entries.Select(e => e.Medication.Time), Is.EqualTo(new[] { Now.AddMinutes(-300), Now.AddMinutes(-400) }));
            Assert.That(last.Entries.Select(e => e.Medication.Time), Is.EqualTo(new[] { Now.AddMinutes(-500) }));
            Assert.That(last.Next, Is.Null);
        });
    }

    [TestCase(null, 20)]
    [TestCase(0, 1)]
    [TestCase(80, 50)]
    public async Task The_page_size_defaults_to_20_and_stays_within_1_to_50(int? limit, int expected)
    {
        for (var i = 1; i <= 60; i++)
        {
            await CreateAsync(_anna, Medication(minutesAgo: i * 10));
        }

        var page = (ListMedicationsResult.Page)await _service.ListAsync(_lea.Id, null, limit);

        Assert.That(page.Entries, Has.Count.EqualTo(expected));
    }

    [Test]
    public async Task A_malformed_cursor_is_refused() =>
        Assert.That(await _service.ListAsync(_lea.Id, "not a cursor", null), Is.TypeOf<ListMedicationsResult.InvalidCursor>());

    [Test]
    public async Task Listing_an_unknown_baby_is_refused() =>
        Assert.That(await _service.ListAsync(Guid.NewGuid(), null, null), Is.TypeOf<ListMedicationsResult.BabyNotFound>());
}
