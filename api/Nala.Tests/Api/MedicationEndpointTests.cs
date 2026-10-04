using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class MedicationEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
    private Guid _annaId;
    private Guid _leaId;
    private DateTimeOffset _now;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _now = DateTimeOffset.UtcNow;
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(_now),
        };
        _admin = _factory.Start();

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();

        response = await _admin.PostAsJsonAsync("/api/babies", new { name = "Lea", birthDate = "2026-09-01" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        _leaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    /// <summary>Ben joins through an invitation seeded from Anna and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterBenAsync()
    {
        var token = LinkToken.Generate();
        using (var scope = _factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
            {
                Id = Guid.NewGuid(),
                TokenHash = LinkToken.Hash(token),
                CreatedByUserId = _annaId,
                CreatedAt = _now,
                ExpiresAt = _now + InvitationPolicy.Lifetime,
            });
        }

        var client = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private object Medication(
        Guid? id = null, Guid? babyId = null, int minutesAgo = 10, string? name = "Paracetamol", decimal? amount = 2.5m, string? unit = "ml", string? notes = null) => new
        {
            id = id ?? Guid.NewGuid(),
            babyId = babyId ?? _leaId,
            time = _now.AddMinutes(-minutesAgo),
            name,
            amount,
            unit,
            notes,
        };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/medications{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static void AssertCode(JsonElement body, string code) =>
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code));

    [Test]
    public async Task A_dose_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/medications", Medication(id, name: " Vitamin D ", amount: 4m, unit: "drops", notes: "morning"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/medications/{id}"));
        var medication = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(medication.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(medication.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(medication.GetProperty("time").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-10)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(medication.GetProperty("name").GetString(), Is.EqualTo("Vitamin D"));
            Assert.That(medication.GetProperty("amount").GetDecimal(), Is.EqualTo(4m));
            Assert.That(medication.GetProperty("unit").GetString(), Is.EqualTo("drops"));
            Assert.That(medication.GetProperty("notes").GetString(), Is.EqualTo("morning"));
            Assert.That(medication.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(medication.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(medication.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(medication.TryGetProperty("createdAt", out _), Is.True);
            Assert.That(medication.TryGetProperty("updatedAt", out _), Is.True);
        });
    }

    [Test]
    public async Task The_unit_is_returned_null_without_an_amount()
    {
        var response = await _admin.PostAsJsonAsync("/api/medications", Medication(amount: null, unit: "mg"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var medication = await JsonAsync(response);
        Assert.That(medication.GetProperty("amount").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(medication.GetProperty("unit").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Resending_the_same_medication_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/medications", Medication(id, name: "Paracetamol")));

        var response = await _admin.PostAsJsonAsync("/api/medications", Medication(id, name: "Ibuprofen"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var future = await _admin.PostAsJsonAsync("/api/medications", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            time = _now.AddMinutes(5),
            name = new string('a', 101),
            amount = 1000.5m,
            unit = "spoon",
            notes = new string('a', 1001),
        });
        var missing = await _admin.PostAsJsonAsync("/api/medications", new { id = Guid.NewGuid(), babyId = _leaId, amount = 2.505m });

        Assert.That(future.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(future)).GetProperty("errors");
        var missingErrors = (await JsonAsync(missing)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.GetProperty("time")[0].GetString(), Is.EqualTo("inFuture"));
            Assert.That(errors.GetProperty("name")[0].GetString(), Is.EqualTo("tooLong"));
            Assert.That(errors.GetProperty("amount")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(errors.GetProperty("unit")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(errors.GetProperty("notes")[0].GetString(), Is.EqualTo("tooLong"));
            Assert.That(missingErrors.GetProperty("time")[0].GetString(), Is.EqualTo("required"));
            Assert.That(missingErrors.GetProperty("name")[0].GetString(), Is.EqualTo("required"));
            Assert.That(missingErrors.GetProperty("amount")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(missingErrors.GetProperty("unit")[0].GetString(), Is.EqualTo("required"));
        });
    }

    [Test]
    public async Task The_id_and_the_baby_are_required()
    {
        var response = await _admin.PostAsJsonAsync("/api/medications", new { time = _now.AddMinutes(-5) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("id")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task An_unknown_baby_is_not_found()
    {
        var created = await _admin.PostAsJsonAsync("/api/medications", Medication(babyId: Guid.NewGuid()));
        var listed = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/medications");

        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(created), "babyNotFound");
        Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(listed), "babyNotFound");
    }

    [Test]
    public async Task Medications_are_listed_newest_first_page_by_page()
    {
        for (var i = 1; i <= 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/medications", Medication(minutesAgo: i * 100));
        }

        var first = await PageAsync(_admin, "?limit=2");
        var next = first.GetProperty("next").GetString();
        var second = await PageAsync(_admin, $"?limit=2&cursor={next}");

        Assert.Multiple(() =>
        {
            Assert.That(first.GetProperty("entries").GetArrayLength(), Is.EqualTo(2));
            Assert.That(
                first.GetProperty("entries")[0].GetProperty("time").GetDateTimeOffset(),
                Is.EqualTo(_now.AddMinutes(-100)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(second.GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
            Assert.That(second.GetProperty("next").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task A_malformed_cursor_is_a_validation_problem()
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/medications?cursor=nope!");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task A_medication_is_read_by_id()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/medications", Medication(id));

        var found = await _admin.GetAsync($"/api/medications/{id}");
        var missing = await _admin.GetAsync($"/api/medications/{Guid.NewGuid()}");

        Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(found)).GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(missing), "medicationNotFound");
    }

    [Test]
    public async Task Any_member_edits_any_medication_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/medications", Medication(id));
        var (ben, benId) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/medications/{id}", new
        {
            time = _now.AddMinutes(-20),
            name = "Ibuprofen",
            amount = 50,
            unit = "mg",
            notes = "fever",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var medication = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(medication.GetProperty("time").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-20)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(medication.GetProperty("name").GetString(), Is.EqualTo("Ibuprofen"));
            Assert.That(medication.GetProperty("amount").GetDecimal(), Is.EqualTo(50m));
            Assert.That(medication.GetProperty("unit").GetString(), Is.EqualTo("mg"));
            Assert.That(medication.GetProperty("notes").GetString(), Is.EqualTo("fever"));
            Assert.That(medication.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(medication.GetProperty("updatedBy").GetProperty("id").GetGuid(), Is.EqualTo(benId));
            Assert.That(medication.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_validates_and_an_unknown_medication_is_not_found()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/medications", Medication(id));

        var invalid = await _admin.PutAsJsonAsync($"/api/medications/{id}", new { time = _now.AddMinutes(10), name = "Paracetamol" });
        var unknown = await _admin.PutAsJsonAsync($"/api/medications/{Guid.NewGuid()}", new { time = _now.AddMinutes(-10), name = "Paracetamol" });

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(invalid)).GetProperty("errors").GetProperty("time")[0].GetString(), Is.EqualTo("inFuture"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "medicationNotFound");
    }

    [Test]
    public async Task Any_member_deletes_any_medication()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/medications", Medication(id));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.DeleteAsync($"/api/medications/{id}");
        var again = await ben.DeleteAsync($"/api/medications/{id}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(again), "medicationNotFound");
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Medications_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/medications", Medication());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var medication = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(medication.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Medications_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/medications")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/medications", Medication())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
