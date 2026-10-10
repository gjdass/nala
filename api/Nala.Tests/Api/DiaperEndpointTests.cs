using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class DiaperEndpointTests
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
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();

        response = await TestBabies.PostAsync(_admin, new { name = "Lea", birthDate = "2026-09-01" });
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

    private object Diaper(Guid? id = null, Guid? babyId = null, int minutesAgo = 10, bool wet = true, bool dirty = false, bool rash = false, string? notes = null) => new
    {
        id = id ?? Guid.NewGuid(),
        babyId = babyId ?? _leaId,
        time = _now.AddMinutes(-minutesAgo),
        wet,
        dirty,
        rash,
        notes,
    };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/diapers{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static void AssertCode(JsonElement body, string code) =>
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code));

    [Test]
    public async Task A_diaper_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/diapers", Diaper(id, wet: true, dirty: true, rash: true, notes: "big one"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/diapers/{id}"));
        var diaper = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(diaper.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(diaper.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(diaper.GetProperty("time").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-10)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(diaper.GetProperty("wet").GetBoolean(), Is.True);
            Assert.That(diaper.GetProperty("dirty").GetBoolean(), Is.True);
            Assert.That(diaper.GetProperty("rash").GetBoolean(), Is.True);
            Assert.That(diaper.GetProperty("notes").GetString(), Is.EqualTo("big one"));
            Assert.That(diaper.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(diaper.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(diaper.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(diaper.TryGetProperty("createdAt", out _), Is.True);
            Assert.That(diaper.TryGetProperty("updatedAt", out _), Is.True);
        });
    }

    [Test]
    public async Task Missing_toggles_default_to_false_a_dry_diaper()
    {
        var response = await _admin.PostAsJsonAsync("/api/diapers", new { id = Guid.NewGuid(), babyId = _leaId, time = _now.AddMinutes(-5) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var diaper = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(diaper.GetProperty("wet").GetBoolean(), Is.False);
            Assert.That(diaper.GetProperty("dirty").GetBoolean(), Is.False);
            Assert.That(diaper.GetProperty("rash").GetBoolean(), Is.False);
        });
    }

    [Test]
    public async Task A_dirty_diaper_is_created_with_its_colour_and_consistency()
    {
        var response = await _admin.PostAsJsonAsync("/api/diapers", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            time = _now.AddMinutes(-5),
            dirty = true,
            color = "yellow",
            consistency = "soft",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var diaper = await JsonAsync(response);
        Assert.That(diaper.GetProperty("color").GetString(), Is.EqualTo("yellow"));
        Assert.That(diaper.GetProperty("consistency").GetString(), Is.EqualTo("soft"));
    }

    [Test]
    public async Task Colour_and_consistency_are_returned_null_when_not_dirty()
    {
        var response = await _admin.PostAsJsonAsync("/api/diapers", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            time = _now.AddMinutes(-5),
            wet = true,
            color = "purple",
            consistency = "soft",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var diaper = await JsonAsync(response);
        Assert.That(diaper.GetProperty("color").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(diaper.GetProperty("consistency").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Unknown_colour_or_consistency_is_a_validation_problem()
    {
        var response = await _admin.PostAsJsonAsync("/api/diapers", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            time = _now.AddMinutes(-5),
            dirty = true,
            color = "purple",
            consistency = "gooey",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("color")[0].GetString(), Is.EqualTo("invalid"));
        Assert.That(errors.GetProperty("consistency")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task Resending_the_same_diaper_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/diapers", Diaper(id, notes: "first")));

        var response = await _admin.PostAsJsonAsync("/api/diapers", Diaper(id, dirty: true, notes: "second"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var future = await _admin.PostAsJsonAsync("/api/diapers", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            time = _now.AddMinutes(5),
            notes = new string('a', 1001),
        });
        var missing = await _admin.PostAsJsonAsync("/api/diapers", new { id = Guid.NewGuid(), babyId = _leaId });

        Assert.That(future.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(future)).GetProperty("errors");
        var missingErrors = (await JsonAsync(missing)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.TryGetProperty("time", out _), Is.False, "a time in the future is accepted");
            Assert.That(errors.GetProperty("notes")[0].GetString(), Is.EqualTo("tooLong"));
            Assert.That(missingErrors.GetProperty("time")[0].GetString(), Is.EqualTo("required"));
        });
    }

    [Test]
    public async Task The_id_and_the_baby_are_required()
    {
        var response = await _admin.PostAsJsonAsync("/api/diapers", new { time = _now.AddMinutes(-5) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("id")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task An_unknown_baby_is_not_found()
    {
        var created = await _admin.PostAsJsonAsync("/api/diapers", Diaper(babyId: Guid.NewGuid()));
        var listed = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/diapers");

        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(created), "babyNotFound");
        Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(listed), "babyNotFound");
    }

    [Test]
    public async Task Diapers_are_listed_newest_first_page_by_page()
    {
        for (var i = 1; i <= 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/diapers", Diaper(minutesAgo: i * 100));
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
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/diapers?cursor=nope!");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task A_diaper_is_read_by_id()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/diapers", Diaper(id));

        var found = await _admin.GetAsync($"/api/diapers/{id}");
        var missing = await _admin.GetAsync($"/api/diapers/{Guid.NewGuid()}");

        Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(found)).GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(missing), "diaperNotFound");
    }

    [Test]
    public async Task Any_member_edits_any_diaper_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/diapers", Diaper(id));
        var (ben, benId) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/diapers/{id}", new
        {
            time = _now.AddMinutes(-20),
            wet = false,
            dirty = true,
            rash = true,
            color = "green",
            consistency = "firm",
            notes = "oops",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var diaper = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(diaper.GetProperty("time").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-20)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(diaper.GetProperty("wet").GetBoolean(), Is.False);
            Assert.That(diaper.GetProperty("dirty").GetBoolean(), Is.True);
            Assert.That(diaper.GetProperty("rash").GetBoolean(), Is.True);
            Assert.That(diaper.GetProperty("color").GetString(), Is.EqualTo("green"));
            Assert.That(diaper.GetProperty("consistency").GetString(), Is.EqualTo("firm"));
            Assert.That(diaper.GetProperty("notes").GetString(), Is.EqualTo("oops"));
            Assert.That(diaper.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(diaper.GetProperty("updatedBy").GetProperty("id").GetGuid(), Is.EqualTo(benId));
            Assert.That(diaper.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_validates_and_an_unknown_diaper_is_not_found()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/diapers", Diaper(id));

        var invalid = await _admin.PutAsJsonAsync($"/api/diapers/{id}", new { notes = "no time" });
        var unknown = await _admin.PutAsJsonAsync($"/api/diapers/{Guid.NewGuid()}", new { time = _now.AddMinutes(-10) });

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(invalid)).GetProperty("errors").GetProperty("time")[0].GetString(), Is.EqualTo("required"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "diaperNotFound");
    }

    [Test]
    public async Task Any_member_deletes_any_diaper()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/diapers", Diaper(id));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.DeleteAsync($"/api/diapers/{id}");
        var again = await ben.DeleteAsync($"/api/diapers/{id}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(again), "diaperNotFound");
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Diapers_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/diapers", Diaper());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var diaper = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(diaper.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Diapers_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/diapers")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/diapers", Diaper())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
