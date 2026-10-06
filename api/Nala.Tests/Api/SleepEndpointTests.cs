using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class SleepEndpointTests
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

    private object Sleep(Guid? id = null, Guid? babyId = null, int startMinutesAgo = 120, int endMinutesAgo = 60, string? notes = null) => new
    {
        id = id ?? Guid.NewGuid(),
        babyId = babyId ?? _leaId,
        startTime = _now.AddMinutes(-startMinutesAgo),
        endTime = _now.AddMinutes(-endMinutesAgo),
        notes,
    };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/sleeps{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static void AssertCode(JsonElement body, string code) =>
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code));

    [Test]
    public async Task A_sleep_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id, notes: "stroller"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/sleeps/{id}"));
        var sleep = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(sleep.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(sleep.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(sleep.GetProperty("startTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-120)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(sleep.GetProperty("endTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-60)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(sleep.GetProperty("notes").GetString(), Is.EqualTo("stroller"));
            Assert.That(sleep.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(sleep.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(sleep.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(sleep.TryGetProperty("createdAt", out _), Is.True);
            Assert.That(sleep.TryGetProperty("updatedAt", out _), Is.True);
        });
    }

    [Test]
    public async Task Resending_the_same_sleep_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id, notes: "first")));

        var response = await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id, notes: "second"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var response = await _admin.PostAsJsonAsync("/api/sleeps", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            startTime = _now.AddMinutes(5),
            notes = new string('a', 1001),
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.TryGetProperty("startTime", out _), Is.False, "a startTime in the future is accepted");
            Assert.That(errors.GetProperty("endTime")[0].GetString(), Is.EqualTo("required"));
            Assert.That(errors.GetProperty("notes")[0].GetString(), Is.EqualTo("tooLong"));
        });
    }

    [Test]
    public async Task An_end_before_the_start_is_refused()
    {
        var response = await _admin.PostAsJsonAsync("/api/sleeps", Sleep(startMinutesAgo: 60, endMinutesAgo: 90));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("endTime")[0].GetString(), Is.EqualTo("beforeStart"));
    }

    [Test]
    public async Task The_id_and_the_baby_are_required()
    {
        var response = await _admin.PostAsJsonAsync("/api/sleeps", new { startTime = _now.AddHours(-2), endTime = _now.AddHours(-1) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("id")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task An_unknown_baby_is_not_found()
    {
        var created = await _admin.PostAsJsonAsync("/api/sleeps", Sleep(babyId: Guid.NewGuid()));
        var listed = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/sleeps");

        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(created), "babyNotFound");
        Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(listed), "babyNotFound");
    }

    [Test]
    public async Task Sleeps_are_listed_newest_first_page_by_page()
    {
        for (var i = 1; i <= 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/sleeps", Sleep(startMinutesAgo: i * 100, endMinutesAgo: i * 100 - 30));
        }

        var first = await PageAsync(_admin, "?limit=2");
        var next = first.GetProperty("next").GetString();
        var second = await PageAsync(_admin, $"?limit=2&cursor={next}");

        Assert.Multiple(() =>
        {
            Assert.That(first.GetProperty("entries").GetArrayLength(), Is.EqualTo(2));
            Assert.That(
                first.GetProperty("entries")[0].GetProperty("startTime").GetDateTimeOffset(),
                Is.EqualTo(_now.AddMinutes(-100)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(second.GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
            Assert.That(second.GetProperty("next").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task A_malformed_cursor_is_a_validation_problem()
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/sleeps?cursor=nope!");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task A_sleep_is_read_by_id()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id));

        var found = await _admin.GetAsync($"/api/sleeps/{id}");
        var missing = await _admin.GetAsync($"/api/sleeps/{Guid.NewGuid()}");

        Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(found)).GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(missing), "sleepNotFound");
    }

    [Test]
    public async Task Any_member_edits_any_sleep_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id));
        var (ben, benId) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/sleeps/{id}", new
        {
            startTime = _now.AddMinutes(-90),
            endTime = _now.AddMinutes(-20),
            notes = "woke up happy",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var sleep = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(sleep.GetProperty("endTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-20)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(sleep.GetProperty("notes").GetString(), Is.EqualTo("woke up happy"));
            Assert.That(sleep.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(sleep.GetProperty("updatedBy").GetProperty("id").GetGuid(), Is.EqualTo(benId));
            Assert.That(sleep.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_validates_and_an_unknown_sleep_is_not_found()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id));

        var invalid = await _admin.PutAsJsonAsync($"/api/sleeps/{id}", new { startTime = _now.AddMinutes(-30), endTime = _now.AddMinutes(-40) });
        var unknown = await _admin.PutAsJsonAsync($"/api/sleeps/{Guid.NewGuid()}", new { startTime = _now.AddMinutes(-30), endTime = _now.AddMinutes(-10) });

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(invalid)).GetProperty("errors").GetProperty("endTime")[0].GetString(), Is.EqualTo("beforeStart"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "sleepNotFound");
    }

    [Test]
    public async Task Any_member_deletes_any_sleep()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.DeleteAsync($"/api/sleeps/{id}");
        var again = await ben.DeleteAsync($"/api/sleeps/{id}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(again), "sleepNotFound");
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Sleeps_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/sleeps", Sleep());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var sleep = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(sleep.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Sleeps_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/sleeps")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/sleeps", Sleep())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    private Task<HttpResponseMessage> StartAsync(Guid id, int minutesAgo = 0, Guid? babyId = null, bool? queued = null) =>
        _admin.PostAsJsonAsync($"/api/sleeps/{id}/start", new { babyId = babyId ?? _leaId, at = _now.AddMinutes(-minutesAgo), queued });

    private async Task<Guid> AddBabyAsync(string name)
    {
        var response = await _admin.PostAsJsonAsync("/api/babies", new { name, birthDate = "2026-09-01" });
        return (await JsonAsync(response)).GetProperty("id").GetGuid();
    }

    [Test]
    public async Task Start_creates_a_live_sleep_listed_at_once()
    {
        var id = Guid.NewGuid();

        var response = await StartAsync(id, minutesAgo: 5);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/sleeps/{id}"));
        var body = await JsonAsync(response);
        var listed = (await PageAsync(_admin)).GetProperty("entries")[0];
        Assert.Multiple(() =>
        {
            Assert.That(body.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(body.GetProperty("startTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-5)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(body.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(body.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(listed.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(listed.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task Start_on_a_stopped_sleep_makes_it_live_again_and_twice_changes_nothing()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/sleeps", Sleep(id, startMinutesAgo: 90, endMinutesAgo: 30));

        var restarted = await StartAsync(id);
        var again = await StartAsync(id);

        Assert.That(restarted.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await JsonAsync(again);
        Assert.That(body.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(body.GetProperty("startTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-90)).Within(TimeSpan.FromMilliseconds(1)));
    }

    [Test]
    public async Task Start_while_another_sleep_is_live_is_a_conflict_unless_queued()
    {
        await StartAsync(Guid.NewGuid(), minutesAgo: 20);

        var refused = await StartAsync(Guid.NewGuid());
        var queued = await StartAsync(Guid.NewGuid(), minutesAgo: 10, queued: true);

        Assert.That(refused.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
        AssertCode(await JsonAsync(refused), "sleepInProgress");
        Assert.That(queued.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var live = (await JsonAsync(await _admin.GetAsync("/api/live"))).GetProperty("sleeps");
        Assert.That(live.GetArrayLength(), Is.EqualTo(2));
    }

    [Test]
    public async Task Start_validates_its_body_and_the_baby()
    {
        var missing = await _admin.PostAsJsonAsync($"/api/sleeps/{Guid.NewGuid()}/start", new { });
        var future = await StartAsync(Guid.NewGuid(), minutesAgo: -5);
        var unknown = await StartAsync(Guid.NewGuid(), babyId: Guid.NewGuid());

        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(missing)).GetProperty("errors");
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
        Assert.That(future.StatusCode, Is.EqualTo(HttpStatusCode.Created), "a start in the future is accepted");
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "babyNotFound");
    }

    [Test]
    public async Task Stop_ends_the_live_sleep()
    {
        var id = Guid.NewGuid();
        await StartAsync(id, minutesAgo: 30);

        var response = await _admin.PostAsJsonAsync($"/api/sleeps/{id}/stop", new { at = _now });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetProperty("endTime").GetDateTimeOffset(), Is.EqualTo(_now).Within(TimeSpan.FromMilliseconds(1)));
        Assert.That((await JsonAsync(await _admin.GetAsync("/api/live"))).GetProperty("sleeps").GetArrayLength(), Is.EqualTo(0));
    }

    [Test]
    public async Task Stop_before_the_start_or_on_an_unknown_sleep_is_refused()
    {
        var id = Guid.NewGuid();
        await StartAsync(id, minutesAgo: 30);

        var early = await _admin.PostAsJsonAsync($"/api/sleeps/{id}/stop", new { at = _now.AddMinutes(-40) });
        var unknown = await _admin.PostAsJsonAsync($"/api/sleeps/{Guid.NewGuid()}/stop", new { at = _now });

        Assert.That(early.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(early)).GetProperty("errors").GetProperty("at")[0].GetString(), Is.EqualTo("invalid"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "sleepNotFound");
    }

    [Test]
    public async Task Editing_a_live_sleep_keeps_it_live_and_refuses_an_end_time()
    {
        var id = Guid.NewGuid();
        await StartAsync(id, minutesAgo: 30);

        var edited = await _admin.PutAsJsonAsync($"/api/sleeps/{id}", new { startTime = _now.AddMinutes(-45), endTime = (DateTimeOffset?)null, notes = "cot" });
        var withEnd = await _admin.PutAsJsonAsync($"/api/sleeps/{id}", new { startTime = _now.AddMinutes(-45), endTime = _now, notes = "cot" });

        Assert.That(edited.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await JsonAsync(edited);
        Assert.That(body.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(body.GetProperty("startTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-45)).Within(TimeSpan.FromMilliseconds(1)));
        Assert.That(body.GetProperty("notes").GetString(), Is.EqualTo("cot"));
        Assert.That(withEnd.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(withEnd)).GetProperty("errors").GetProperty("endTime")[0].GetString(), Is.EqualTo("notAllowed"));
    }
}
