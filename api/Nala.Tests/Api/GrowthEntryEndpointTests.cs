using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class GrowthEntryEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
    private Guid _annaId;
    private Guid _leaId;
    private DateTimeOffset _now;
    private DateOnly _today;
    private DateOnly _birthDate;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _now = DateTimeOffset.UtcNow;
        _today = DateOnly.FromDateTime(_now.UtcDateTime);
        _birthDate = _today.AddDays(-60);
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(_now),
        };
        _admin = _factory.Start();

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();

        response = await TestBabies.PostAsync(_admin, new
        {
            name = "Lea",
            birthDate = _birthDate.ToString("yyyy-MM-dd"),
            birthWeightG = 3200,
            birthLengthCm = 49.5m,
        });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        _leaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    /// <summary>Ben joins Anna's family through an invitation seeded from Anna and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterBenAsync()
    {
        var token = LinkToken.Generate();
        var familyId = (await _admin.GetFromJsonAsync<JsonElement[]>("/api/families"))![0].GetProperty("id").GetGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
            {
                Id = Guid.NewGuid(),
                TokenHash = LinkToken.Hash(token),
                FamilyId = familyId,
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

    private string DaysAgo(int days) => _today.AddDays(-days).ToString("yyyy-MM-dd");

    private object Measurement(
        Guid? id = null, Guid? babyId = null, int daysAgo = 2, int? weightG = 4250, decimal? lengthCm = 55.5m, decimal? headCircumferenceCm = 38m, string? notes = null) => new
        {
            id = id ?? Guid.NewGuid(),
            babyId = babyId ?? _leaId,
            kind = "measurement",
            date = DaysAgo(daysAgo),
            weightG,
            lengthCm,
            headCircumferenceCm,
            notes,
        };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/growth-entries{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static void AssertCode(JsonElement body, string code) =>
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code));

    [Test]
    public async Task A_measurement_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id, notes: " doctor "));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/growth-entries/{id}"));
        var entry = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(entry.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(entry.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(entry.GetProperty("kind").GetString(), Is.EqualTo("measurement"));
            Assert.That(entry.GetProperty("date").GetString(), Is.EqualTo(DaysAgo(2)));
            Assert.That(entry.GetProperty("weightG").GetInt32(), Is.EqualTo(4250));
            Assert.That(entry.GetProperty("lengthCm").GetDecimal(), Is.EqualTo(55.5m));
            Assert.That(entry.GetProperty("headCircumferenceCm").GetDecimal(), Is.EqualTo(38m));
            Assert.That(entry.GetProperty("notes").GetString(), Is.EqualTo("doctor"));
            Assert.That(entry.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(entry.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(entry.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(entry.TryGetProperty("createdAt", out _), Is.True);
            Assert.That(entry.TryGetProperty("updatedAt", out _), Is.True);
        });
    }

    [Test]
    public async Task Missing_values_are_returned_null()
    {
        var response = await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(lengthCm: null, headCircumferenceCm: null));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var entry = await JsonAsync(response);
        Assert.That(entry.GetProperty("lengthCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(entry.GetProperty("headCircumferenceCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(entry.GetProperty("notes").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Resending_the_same_entry_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id, weightG: 4250)));

        var response = await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id, weightG: 5000));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var outOfRange = await _admin.PostAsJsonAsync("/api/growth-entries", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "measurement",
            date = _today.AddDays(2).ToString("yyyy-MM-dd"),
            weightG = 30001,
            lengthCm = 19.9m,
            headCircumferenceCm = 60.1m,
            notes = new string('a', 1001),
        });
        var imprecise = await _admin.PostAsJsonAsync("/api/growth-entries", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "measurement",
            date = _birthDate.AddDays(-1).ToString("yyyy-MM-dd"),
            weightG = 4250.5m,
            lengthCm = 55.55m,
            headCircumferenceCm = 38.05m,
        });
        var empty = await _admin.PostAsJsonAsync("/api/growth-entries", new { id = Guid.NewGuid(), babyId = _leaId, kind = "measurement" });
        var unknownKind = await _admin.PostAsJsonAsync("/api/growth-entries", new { id = Guid.NewGuid(), babyId = _leaId, kind = "photo", date = DaysAgo(1), weightG = 4000 });
        var noKind = await _admin.PostAsJsonAsync("/api/growth-entries", new { id = Guid.NewGuid(), babyId = _leaId, date = DaysAgo(1), weightG = 4000 });

        var errors = (await JsonAsync(outOfRange)).GetProperty("errors");
        var impreciseErrors = (await JsonAsync(imprecise)).GetProperty("errors");
        var emptyErrors = (await JsonAsync(empty)).GetProperty("errors");
        var unknownKindErrors = (await JsonAsync(unknownKind)).GetProperty("errors");
        var noKindErrors = (await JsonAsync(noKind)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(outOfRange.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(errors.TryGetProperty("date", out _), Is.False, "a date in the future is accepted");
            Assert.That(errors.GetProperty("weightG")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(errors.GetProperty("lengthCm")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(errors.GetProperty("headCircumferenceCm")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(errors.GetProperty("notes")[0].GetString(), Is.EqualTo("tooLong"));
            Assert.That(impreciseErrors.GetProperty("date")[0].GetString(), Is.EqualTo("beforeBirth"));
            Assert.That(impreciseErrors.GetProperty("weightG")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(impreciseErrors.GetProperty("lengthCm")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(impreciseErrors.GetProperty("headCircumferenceCm")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(emptyErrors.GetProperty("date")[0].GetString(), Is.EqualTo("required"));
            Assert.That(emptyErrors.GetProperty("measurements")[0].GetString(), Is.EqualTo("required"));
            Assert.That(unknownKindErrors.GetProperty("kind")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(noKindErrors.GetProperty("kind")[0].GetString(), Is.EqualTo("required"));
        });
    }

    [Test]
    public async Task The_id_and_the_baby_are_required()
    {
        var response = await _admin.PostAsJsonAsync("/api/growth-entries", new { kind = "measurement", date = DaysAgo(1), weightG = 4000 });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("id")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task An_unknown_baby_is_not_found()
    {
        var created = await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(babyId: Guid.NewGuid()));
        var listed = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/growth-entries");
        var latest = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/growth-entries/latest");

        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(created), "babyNotFound");
        Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(listed), "babyNotFound");
        Assert.That(latest.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(latest), "babyNotFound");
    }

    [Test]
    public async Task Entries_are_listed_newest_date_first_page_by_page()
    {
        for (var i = 1; i <= 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(daysAgo: i * 5));
        }

        var first = await PageAsync(_admin, "?limit=2");
        var next = first.GetProperty("next").GetString();
        var second = await PageAsync(_admin, $"?limit=2&cursor={next}");

        Assert.Multiple(() =>
        {
            Assert.That(first.GetProperty("entries").GetArrayLength(), Is.EqualTo(2));
            Assert.That(first.GetProperty("entries")[0].GetProperty("date").GetString(), Is.EqualTo(DaysAgo(5)));
            Assert.That(first.GetProperty("entries")[1].GetProperty("date").GetString(), Is.EqualTo(DaysAgo(10)));
            Assert.That(second.GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
            Assert.That(second.GetProperty("entries")[0].GetProperty("date").GetString(), Is.EqualTo(DaysAgo(15)));
            Assert.That(second.GetProperty("next").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task A_malformed_cursor_is_a_validation_problem()
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/growth-entries?cursor=nope!");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task An_entry_is_read_by_id()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id));

        var found = await _admin.GetAsync($"/api/growth-entries/{id}");
        var missing = await _admin.GetAsync($"/api/growth-entries/{Guid.NewGuid()}");

        Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(found)).GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(missing), "growthEntryNotFound");
    }

    [Test]
    public async Task Any_member_edits_any_entry_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id));
        var (ben, benId) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/growth-entries/{id}", new
        {
            date = DaysAgo(1),
            weightG = 4400,
            lengthCm = (decimal?)null,
            headCircumferenceCm = 38.5m,
            notes = "home scale",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var entry = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(entry.GetProperty("kind").GetString(), Is.EqualTo("measurement"));
            Assert.That(entry.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(entry.GetProperty("date").GetString(), Is.EqualTo(DaysAgo(1)));
            Assert.That(entry.GetProperty("weightG").GetInt32(), Is.EqualTo(4400));
            Assert.That(entry.GetProperty("lengthCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(entry.GetProperty("headCircumferenceCm").GetDecimal(), Is.EqualTo(38.5m));
            Assert.That(entry.GetProperty("notes").GetString(), Is.EqualTo("home scale"));
            Assert.That(entry.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(entry.GetProperty("updatedBy").GetProperty("id").GetGuid(), Is.EqualTo(benId));
            Assert.That(entry.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_validates_and_an_unknown_entry_is_not_found()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id));

        var invalid = await _admin.PutAsJsonAsync($"/api/growth-entries/{id}", new { date = DaysAgo(1) });
        var unknown = await _admin.PutAsJsonAsync($"/api/growth-entries/{Guid.NewGuid()}", new { date = DaysAgo(1), weightG = 4000 });

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(invalid)).GetProperty("errors").GetProperty("measurements")[0].GetString(), Is.EqualTo("required"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "growthEntryNotFound");
    }

    [Test]
    public async Task Any_member_deletes_any_entry()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.DeleteAsync($"/api/growth-entries/{id}");
        var again = await ben.DeleteAsync($"/api/growth-entries/{id}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(again), "growthEntryNotFound");
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Another_family_reaches_neither_the_baby_nor_its_entries()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id, notes: "ours"));
        var stored = await JsonAsync(await _admin.GetAsync($"/api/growth-entries/{id}"));
        using var carl = await OtherFamily.CreateAsync(_factory);
        var maxId = await Isolation.AddBabyAsync(carl);
        var client = carl.Client;

        await Isolation.AssertNotFoundAsync(client.PostAsJsonAsync("/api/growth-entries", Measurement()), "babyNotFound", "create on Lea");
        await Isolation.AssertNotFoundAsync(client.GetAsync($"/api/babies/{_leaId}/growth-entries"), "babyNotFound", "list");
        await Isolation.AssertNotFoundAsync(client.GetAsync($"/api/babies/{_leaId}/growth-entries/latest"), "babyNotFound", "latest");
        await Isolation.AssertNotFoundAsync(client.GetAsync($"/api/growth-entries/{id}"), "growthEntryNotFound", "get");
        await Isolation.AssertNotFoundAsync(
            client.PutAsJsonAsync($"/api/growth-entries/{id}", new { date = DaysAgo(1), weightG = 4000, notes = "theirs" }), "growthEntryNotFound", "edit");
        await Isolation.AssertNotFoundAsync(client.DeleteAsync($"/api/growth-entries/{id}"), "growthEntryNotFound", "delete");
        await Isolation.AssertNotFoundAsync(
            client.PostAsJsonAsync("/api/growth-entries", Measurement(id, babyId: maxId, notes: "theirs")), "growthEntryNotFound", "re-send with our id");

        Assert.That((await JsonAsync(await _admin.GetAsync($"/api/growth-entries/{id}"))).GetRawText(), Is.EqualTo(stored.GetRawText()));
    }

    [Test]
    public async Task Latest_gives_each_measure_from_its_most_recent_measurement_else_from_birth_else_null()
    {
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(daysAgo: 10, weightG: 3800, lengthCm: null, headCircumferenceCm: 36m));
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(daysAgo: 3, weightG: 4100, lengthCm: null, headCircumferenceCm: null));

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/growth-entries/latest");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var latest = await JsonAsync(response);
        var weight = latest.GetProperty("weight");
        var length = latest.GetProperty("length");
        var head = latest.GetProperty("headCircumference");
        Assert.Multiple(() =>
        {
            Assert.That(weight.GetProperty("value").GetDecimal(), Is.EqualTo(4100m));
            Assert.That(weight.GetProperty("date").GetString(), Is.EqualTo(DaysAgo(3)));
            Assert.That(weight.GetProperty("birth").GetBoolean(), Is.False);
            Assert.That(length.GetProperty("value").GetDecimal(), Is.EqualTo(49.5m));
            Assert.That(length.GetProperty("date").GetString(), Is.EqualTo(_birthDate.ToString("yyyy-MM-dd")));
            Assert.That(length.GetProperty("birth").GetBoolean(), Is.True);
            Assert.That(head.GetProperty("value").GetDecimal(), Is.EqualTo(36m));
            Assert.That(head.GetProperty("birth").GetBoolean(), Is.False);
        });
    }

    private object Milestone(Guid? id = null, int daysAgo = 2, string? milestone = "firstTooth", string? title = null) => new
    {
        id = id ?? Guid.NewGuid(),
        babyId = _leaId,
        kind = "milestone",
        date = DaysAgo(daysAgo),
        milestone,
        title,
        weightG = 4250,
        lengthCm = 55.5m,
        headCircumferenceCm = 38m,
        notes = (string?)null,
    };

    [Test]
    public async Task A_milestone_is_created_with_its_preset_a_null_title_and_no_values()
    {
        var response = await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(title: "ignored"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var entry = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(entry.GetProperty("kind").GetString(), Is.EqualTo("milestone"));
            Assert.That(entry.GetProperty("milestone").GetString(), Is.EqualTo("firstTooth"));
            Assert.That(entry.GetProperty("title").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(entry.GetProperty("weightG").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(entry.GetProperty("lengthCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(entry.GetProperty("headCircumferenceCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task A_custom_milestone_keeps_its_trimmed_title()
    {
        var entry = await JsonAsync(await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(milestone: "custom", title: " First swim ")));

        Assert.That(entry.GetProperty("milestone").GetString(), Is.EqualTo("custom"));
        Assert.That(entry.GetProperty("title").GetString(), Is.EqualTo("First swim"));
    }

    [Test]
    public async Task A_measurement_ignores_and_returns_null_milestone_fields()
    {
        var body = new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "measurement",
            date = DaysAgo(2),
            weightG = 4250,
            milestone = "custom",
            title = "nope",
        };

        var entry = await JsonAsync(await _admin.PostAsJsonAsync("/api/growth-entries", body));

        Assert.That(entry.GetProperty("milestone").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(entry.GetProperty("title").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [TestCase(null, null, "milestone", "required")]
    [TestCase("firstTeeth", null, "milestone", "invalid")]
    [TestCase("custom", "  ", "title", "required")]
    public async Task Milestone_fields_answer_validation_codes(string? milestone, string? title, string field, string code)
    {
        var response = await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(milestone: milestone, title: title));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty(field)[0].GetString(), Is.EqualTo(code));
    }

    [Test]
    public async Task A_custom_title_over_100_characters_is_too_long()
    {
        var response = await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(milestone: "custom", title: new string('a', 101)));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("title")[0].GetString(), Is.EqualTo("tooLong"));
    }

    [Test]
    public async Task Editing_a_milestone_replaces_its_fields_and_a_preset_clears_the_title()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(id, milestone: "custom", title: "First swim"));

        var response = await _admin.PutAsJsonAsync($"/api/growth-entries/{id}", new
        {
            date = DaysAgo(1),
            milestone = "firstSteps",
            title = "still sent",
            notes = "park",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var entry = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(entry.GetProperty("kind").GetString(), Is.EqualTo("milestone"));
            Assert.That(entry.GetProperty("milestone").GetString(), Is.EqualTo("firstSteps"));
            Assert.That(entry.GetProperty("title").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(entry.GetProperty("date").GetString(), Is.EqualTo(DaysAgo(1)));
            Assert.That(entry.GetProperty("notes").GetString(), Is.EqualTo("park"));
        });
    }

    [Test]
    public async Task Milestones_and_measurements_are_listed_together_newest_date_first()
    {
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(daysAgo: 5));
        await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(daysAgo: 3));

        var entries = (await PageAsync(_admin)).GetProperty("entries");

        Assert.That(entries[0].GetProperty("kind").GetString(), Is.EqualTo("milestone"));
        Assert.That(entries[1].GetProperty("kind").GetString(), Is.EqualTo("measurement"));
    }

    [Test]
    public async Task Latest_ignores_milestones()
    {
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(daysAgo: 10, weightG: 3800));
        await _admin.PostAsJsonAsync("/api/growth-entries", Milestone(daysAgo: 1));

        var latest = await JsonAsync(await _admin.GetAsync($"/api/babies/{_leaId}/growth-entries/latest"));

        Assert.That(latest.GetProperty("weight").GetProperty("value").GetDecimal(), Is.EqualTo(3800m));
        Assert.That(latest.GetProperty("weight").GetProperty("date").GetString(), Is.EqualTo(DaysAgo(10)));
    }

    [Test]
    public async Task Latest_without_any_value_is_null_for_each_measure()
    {
        var response = await TestBabies.PostAsync(_admin, new { name = "Tom", birthDate = DaysAgo(5) });
        var tomId = (await JsonAsync(response)).GetProperty("id").GetGuid();

        var latest = await JsonAsync(await _admin.GetAsync($"/api/babies/{tomId}/growth-entries/latest"));

        Assert.Multiple(() =>
        {
            Assert.That(latest.GetProperty("weight").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(latest.GetProperty("length").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(latest.GetProperty("headCircumference").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task Entries_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/growth-entries", Measurement());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var entry = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(entry.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Growth_entries_are_deleted_with_their_baby()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/growth-entries", Measurement(id));

        var deletion = await _admin.DeleteAsync($"/api/babies/{_leaId}");

        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That((await _admin.GetAsync($"/api/growth-entries/{id}")).StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
    }

    [Test]
    public async Task Growth_entries_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/growth-entries")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/growth-entries/latest")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/growth-entries", Measurement())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
