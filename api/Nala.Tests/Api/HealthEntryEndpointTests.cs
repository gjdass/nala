using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class HealthEntryEndpointTests
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

    private object HealthEntry(
        Guid? id = null, Guid? babyId = null, int minutesAgo = 10, string? name = "Paracetamol", decimal? amount = 2.5m, string? unit = "ml", decimal? temperature = null, string? notes = null) => new
        {
            id = id ?? Guid.NewGuid(),
            babyId = babyId ?? _leaId,
            time = _now.AddMinutes(-minutesAgo),
            name,
            amount,
            unit,
            temperature,
            notes,
        };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/health-entries{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static void AssertCode(JsonElement body, string code) =>
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code));

    [Test]
    public async Task A_dose_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id, name: " Vitamin D ", amount: 4m, unit: "drops", notes: "morning"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/health-entries/{id}"));
        var healthEntry = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(healthEntry.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(healthEntry.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(healthEntry.GetProperty("time").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-10)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(healthEntry.GetProperty("name").GetString(), Is.EqualTo("Vitamin D"));
            Assert.That(healthEntry.GetProperty("amount").GetDecimal(), Is.EqualTo(4m));
            Assert.That(healthEntry.GetProperty("unit").GetString(), Is.EqualTo("drops"));
            Assert.That(healthEntry.GetProperty("notes").GetString(), Is.EqualTo("morning"));
            Assert.That(healthEntry.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(healthEntry.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(healthEntry.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(healthEntry.TryGetProperty("createdAt", out _), Is.True);
            Assert.That(healthEntry.TryGetProperty("updatedAt", out _), Is.True);
        });
    }

    [Test]
    public async Task A_temperature_alone_is_created_without_a_name()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id, name: null, amount: null, unit: null, temperature: 38.5m));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var created = await JsonAsync(response);
        var read = await JsonAsync(await _admin.GetAsync($"/api/health-entries/{id}"));
        Assert.Multiple(() =>
        {
            Assert.That(created.GetProperty("name").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(created.GetProperty("temperature").GetDecimal(), Is.EqualTo(38.5m));
            Assert.That(read.GetProperty("temperature").GetDecimal(), Is.EqualTo(38.5m));
        });
    }

    [Test]
    public async Task A_name_or_a_temperature_is_required_and_the_temperature_is_validated()
    {
        var neither = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(name: null, amount: null, unit: null));
        var noName = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(name: null, temperature: 45.1m));
        var decimals = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(temperature: 38.55m));

        var neitherErrors = (await JsonAsync(neither)).GetProperty("errors");
        var noNameErrors = (await JsonAsync(noName)).GetProperty("errors");
        var decimalsErrors = (await JsonAsync(decimals)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(neither.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(neitherErrors.GetProperty("name")[0].GetString(), Is.EqualTo("required"));
            Assert.That(noNameErrors.GetProperty("amount")[0].GetString(), Is.EqualTo("nameRequired"));
            Assert.That(noNameErrors.GetProperty("temperature")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(decimalsErrors.GetProperty("temperature")[0].GetString(), Is.EqualTo("invalid"));
        });
    }

    [Test]
    public async Task The_unit_is_returned_null_without_an_amount()
    {
        var response = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(amount: null, unit: "mg"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var healthEntry = await JsonAsync(response);
        Assert.That(healthEntry.GetProperty("amount").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(healthEntry.GetProperty("unit").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Resending_the_same_health_entry_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id, name: "Paracetamol")));

        var response = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id, name: "Ibuprofen"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var future = await _admin.PostAsJsonAsync("/api/health-entries", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            time = _now.AddMinutes(5),
            name = new string('a', 101),
            amount = 1000.5m,
            unit = "spoon",
            notes = new string('a', 1001),
        });
        var missing = await _admin.PostAsJsonAsync("/api/health-entries", new { id = Guid.NewGuid(), babyId = _leaId, amount = 2.505m });

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
        var response = await _admin.PostAsJsonAsync("/api/health-entries", new { time = _now.AddMinutes(-5) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("id")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task An_unknown_baby_is_not_found()
    {
        var created = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(babyId: Guid.NewGuid()));
        var listed = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/health-entries");

        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(created), "babyNotFound");
        Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(listed), "babyNotFound");
    }

    [Test]
    public async Task Health_entries_are_listed_newest_first_page_by_page()
    {
        for (var i = 1; i <= 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(minutesAgo: i * 100));
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
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/health-entries?cursor=nope!");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task A_health_entry_is_read_by_id()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id));

        var found = await _admin.GetAsync($"/api/health-entries/{id}");
        var missing = await _admin.GetAsync($"/api/health-entries/{Guid.NewGuid()}");

        Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(found)).GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(missing), "healthEntryNotFound");
    }

    [Test]
    public async Task Any_member_edits_any_health_entry_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id));
        var (ben, benId) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/health-entries/{id}", new
        {
            time = _now.AddMinutes(-20),
            name = "Ibuprofen",
            amount = 50,
            unit = "mg",
            temperature = 38.2m,
            notes = "fever",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var healthEntry = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(healthEntry.GetProperty("time").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-20)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(healthEntry.GetProperty("name").GetString(), Is.EqualTo("Ibuprofen"));
            Assert.That(healthEntry.GetProperty("amount").GetDecimal(), Is.EqualTo(50m));
            Assert.That(healthEntry.GetProperty("unit").GetString(), Is.EqualTo("mg"));
            Assert.That(healthEntry.GetProperty("temperature").GetDecimal(), Is.EqualTo(38.2m));
            Assert.That(healthEntry.GetProperty("notes").GetString(), Is.EqualTo("fever"));
            Assert.That(healthEntry.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(healthEntry.GetProperty("updatedBy").GetProperty("id").GetGuid(), Is.EqualTo(benId));
            Assert.That(healthEntry.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_validates_and_an_unknown_health_entry_is_not_found()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id));

        var invalid = await _admin.PutAsJsonAsync($"/api/health-entries/{id}", new { time = _now.AddMinutes(10), name = "Paracetamol" });
        var unknown = await _admin.PutAsJsonAsync($"/api/health-entries/{Guid.NewGuid()}", new { time = _now.AddMinutes(-10), name = "Paracetamol" });

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(invalid)).GetProperty("errors").GetProperty("time")[0].GetString(), Is.EqualTo("inFuture"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "healthEntryNotFound");
    }

    [Test]
    public async Task Any_member_deletes_any_health_entry()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(id));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.DeleteAsync($"/api/health-entries/{id}");
        var again = await ben.DeleteAsync($"/api/health-entries/{id}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(again), "healthEntryNotFound");
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Health_entries_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/health-entries", HealthEntry());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var healthEntry = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(healthEntry.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Health_entries_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/health-entries")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/health-entries", HealthEntry())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    /// <summary>Spec 09 slice 3: the section was renamed Health, and the Medication routes were removed without an alias.</summary>
    [Test]
    public async Task Old_medication_routes_no_longer_exist()
    {
        var created = await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry());
        var id = (await JsonAsync(created)).GetProperty("id").GetGuid();

        var responses = new[]
        {
            await _admin.PostAsJsonAsync("/api/medications", HealthEntry()),
            await _admin.GetAsync($"/api/medications/{id}"),
            await _admin.PutAsJsonAsync($"/api/medications/{id}", HealthEntry()),
            await _admin.DeleteAsync($"/api/medications/{id}"),
            await _admin.GetAsync($"/api/babies/{_leaId}/medications"),
            await _admin.GetAsync($"/api/babies/{_leaId}/medications/recent"),
        };

        Assert.That(responses.Select(r => r.StatusCode), Has.All.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await _admin.GetAsync($"/api/health-entries/{id}")).StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Recent_doses_list_name_amount_and_unit_most_recent_first()
    {
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(minutesAgo: 100, name: "Paracetamol", amount: 2.5m, unit: "ml"));
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(minutesAgo: 50, name: "Vitamin D", amount: 4m, unit: "drops"));
        await _admin.PostAsJsonAsync("/api/health-entries", HealthEntry(minutesAgo: 10, name: "Saline", amount: null, unit: null));

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/health-entries/recent");
        var recent = await JsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            Assert.That(recent.EnumerateArray().Select(r => r.GetProperty("name").GetString()), Is.EqualTo(new[] { "Saline", "Vitamin D", "Paracetamol" }));
            Assert.That(recent[0].GetProperty("amount").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(recent[0].GetProperty("unit").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(recent[1].GetProperty("amount").GetDecimal(), Is.EqualTo(4m));
            Assert.That(recent[1].GetProperty("unit").GetString(), Is.EqualTo("drops"));
        });
    }

    [Test]
    public async Task Recent_doses_of_a_baby_without_doses_are_empty()
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/health-entries/recent");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetArrayLength(), Is.EqualTo(0));
    }

    [Test]
    public async Task Recent_doses_of_an_unknown_baby_are_not_found()
    {
        var response = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/health-entries/recent");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(response), "babyNotFound");
    }
}
