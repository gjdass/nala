using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class PumpEndpointTests
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

    private object Pump(
        Guid? id = null, Guid? babyId = null, int startMinutesAgo = 40, int endMinutesAgo = 20, int? leftMl = 90, int? rightMl = 80, string? notes = null) => new
        {
            id = id ?? Guid.NewGuid(),
            babyId = babyId ?? _leaId,
            startTime = _now.AddMinutes(-startMinutesAgo),
            endTime = _now.AddMinutes(-endMinutesAgo),
            leftMl,
            rightMl,
            notes,
        };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/pumps{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static void AssertCode(JsonElement body, string code) =>
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code));

    private static void AssertTime(JsonElement value, DateTimeOffset expected) =>
        Assert.That(value.GetDateTimeOffset(), Is.EqualTo(expected).Within(TimeSpan.FromMilliseconds(1)));

    [Test]
    public async Task A_session_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/pumps", Pump(id, notes: "evening"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/pumps/{id}"));
        var pump = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(pump.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(pump.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            AssertTime(pump.GetProperty("startTime"), _now.AddMinutes(-40));
            AssertTime(pump.GetProperty("endTime"), _now.AddMinutes(-20));
            Assert.That(pump.GetProperty("leftMl").GetInt32(), Is.EqualTo(90));
            Assert.That(pump.GetProperty("rightMl").GetInt32(), Is.EqualTo(80));
            Assert.That(pump.GetProperty("notes").GetString(), Is.EqualTo("evening"));
            Assert.That(pump.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(pump.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(pump.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(pump.TryGetProperty("createdAt", out _), Is.True);
            Assert.That(pump.TryGetProperty("updatedAt", out _), Is.True);
        });
    }

    [Test]
    public async Task Volumes_are_optional_and_returned_null()
    {
        var response = await _admin.PostAsJsonAsync("/api/pumps", Pump(leftMl: null, rightMl: null));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var pump = await JsonAsync(response);
        Assert.That(pump.GetProperty("leftMl").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(pump.GetProperty("rightMl").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Resending_the_same_session_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/pumps", Pump(id, notes: "first")));

        var response = await _admin.PostAsJsonAsync("/api/pumps", Pump(id, leftMl: 10, notes: "second"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var response = await _admin.PostAsJsonAsync("/api/pumps", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            startTime = _now.AddMinutes(-10),
            endTime = _now.AddMinutes(-20),
            leftMl = 501,
            rightMl = 90.5,
            notes = new string('a', 1001),
        });
        var missing = await _admin.PostAsJsonAsync("/api/pumps", new { id = Guid.NewGuid(), babyId = _leaId });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        var missingErrors = (await JsonAsync(missing)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.GetProperty("endTime")[0].GetString(), Is.EqualTo("beforeStart"));
            Assert.That(errors.GetProperty("leftMl")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(errors.GetProperty("rightMl")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(errors.GetProperty("notes")[0].GetString(), Is.EqualTo("tooLong"));
            Assert.That(missingErrors.GetProperty("startTime")[0].GetString(), Is.EqualTo("required"));
            Assert.That(missingErrors.GetProperty("endTime")[0].GetString(), Is.EqualTo("required"));
        });
    }

    [Test]
    public async Task The_id_and_the_baby_are_required()
    {
        var response = await _admin.PostAsJsonAsync("/api/pumps", new { startTime = _now.AddMinutes(-40), endTime = _now.AddMinutes(-20) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("id")[0].GetString(), Is.EqualTo("required"));
        Assert.That(errors.GetProperty("babyId")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task An_unknown_baby_is_not_found()
    {
        var created = await _admin.PostAsJsonAsync("/api/pumps", Pump(babyId: Guid.NewGuid()));
        var listed = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/pumps");

        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(created), "babyNotFound");
        Assert.That(listed.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(listed), "babyNotFound");
    }

    [Test]
    public async Task Sessions_are_listed_newest_first_page_by_page()
    {
        for (var i = 1; i <= 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/pumps", Pump(startMinutesAgo: i * 100, endMinutesAgo: i * 100 - 20));
        }

        var first = await PageAsync(_admin, "?limit=2");
        var next = first.GetProperty("next").GetString();
        var second = await PageAsync(_admin, $"?limit=2&cursor={next}");

        Assert.Multiple(() =>
        {
            Assert.That(first.GetProperty("entries").GetArrayLength(), Is.EqualTo(2));
            AssertTime(first.GetProperty("entries")[0].GetProperty("startTime"), _now.AddMinutes(-100));
            Assert.That(second.GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
            Assert.That(second.GetProperty("next").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task A_malformed_cursor_is_a_validation_problem()
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/pumps?cursor=nope!");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task A_session_is_read_by_id()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/pumps", Pump(id));

        var found = await _admin.GetAsync($"/api/pumps/{id}");
        var missing = await _admin.GetAsync($"/api/pumps/{Guid.NewGuid()}");

        Assert.That(found.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(found)).GetProperty("id").GetGuid(), Is.EqualTo(id));
        Assert.That(missing.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(missing), "pumpNotFound");
    }

    [Test]
    public async Task Any_member_edits_any_session_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/pumps", Pump(id));
        var (ben, benId) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/pumps/{id}", new
        {
            startTime = _now.AddMinutes(-60),
            endTime = _now.AddMinutes(-45),
            leftMl = 0,
            rightMl = (int?)null,
            notes = "only left tried",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var pump = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            AssertTime(pump.GetProperty("startTime"), _now.AddMinutes(-60));
            AssertTime(pump.GetProperty("endTime"), _now.AddMinutes(-45));
            Assert.That(pump.GetProperty("leftMl").GetInt32(), Is.EqualTo(0));
            Assert.That(pump.GetProperty("rightMl").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(pump.GetProperty("notes").GetString(), Is.EqualTo("only left tried"));
            Assert.That(pump.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(pump.GetProperty("updatedBy").GetProperty("id").GetGuid(), Is.EqualTo(benId));
            Assert.That(pump.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_validates_and_an_unknown_session_is_not_found()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/pumps", Pump(id));

        var invalid = await _admin.PutAsJsonAsync($"/api/pumps/{id}", new { startTime = _now.AddMinutes(-40), endTime = _now.AddMinutes(-20), rightMl = -1 });
        var unknown = await _admin.PutAsJsonAsync($"/api/pumps/{Guid.NewGuid()}", new { startTime = _now.AddMinutes(-40), endTime = _now.AddMinutes(-20) });

        Assert.That(invalid.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(invalid)).GetProperty("errors").GetProperty("rightMl")[0].GetString(), Is.EqualTo("outOfRange"));
        Assert.That(unknown.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(unknown), "pumpNotFound");
    }

    [Test]
    public async Task Any_member_deletes_any_session()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/pumps", Pump(id));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.DeleteAsync($"/api/pumps/{id}");
        var again = await ben.DeleteAsync($"/api/pumps/{id}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        AssertCode(await JsonAsync(again), "pumpNotFound");
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Sessions_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/pumps", Pump());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var pump = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(pump.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Pumps_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/pumps")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/pumps", Pump())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
