using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class FeedEndpointTests
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

    private object Bottle(Guid? id = null, Guid? babyId = null, string milkType = "formula", int amountMl = 120, DateTimeOffset? startTime = null, string? notes = null) => new
    {
        id = id ?? Guid.NewGuid(),
        babyId = babyId ?? _leaId,
        kind = "bottle",
        startTime = startTime ?? _now.AddMinutes(-10),
        notes,
        milkType,
        amountMl,
    };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> PageAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/babies/{_leaId}/feeds{query}");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    [Test]
    public async Task A_bottle_is_created_with_who_logged_it()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/feeds", Bottle(id, milkType: "breastMilk", amountMl: 90, notes: "sleepy"));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var feed = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(feed.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(feed.GetProperty("babyId").GetGuid(), Is.EqualTo(_leaId));
            Assert.That(feed.GetProperty("kind").GetString(), Is.EqualTo("bottle"));
            Assert.That(feed.GetProperty("startTime").GetDateTimeOffset(), Is.EqualTo(_now.AddMinutes(-10)).Within(TimeSpan.FromMilliseconds(1)));
            Assert.That(feed.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(feed.GetProperty("notes").GetString(), Is.EqualTo("sleepy"));
            Assert.That(feed.GetProperty("milkType").GetString(), Is.EqualTo("breastMilk"));
            Assert.That(feed.GetProperty("amountMl").GetInt32(), Is.EqualTo(90));
            Assert.That(feed.GetProperty("loggedBy").GetProperty("id").GetGuid(), Is.EqualTo(_annaId));
            Assert.That(feed.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(feed.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
        });
        Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"/api/feeds/{id}"));
    }

    [Test]
    public async Task Resending_the_same_feed_answers_the_stored_one()
    {
        var id = Guid.NewGuid();
        var first = await JsonAsync(await _admin.PostAsJsonAsync("/api/feeds", Bottle(id, amountMl: 90)));

        var response = await _admin.PostAsJsonAsync("/api/feeds", Bottle(id, amountMl: 150));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That((await JsonAsync(response)).GetRawText(), Is.EqualTo(first.GetRawText()));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var response = await _admin.PostAsJsonAsync("/api/feeds", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "bottle",
            startTime = _now.AddMinutes(5),
            milkType = "milk",
            amountMl = 501,
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.GetProperty("startTime")[0].GetString(), Is.EqualTo("inFuture"));
            Assert.That(errors.GetProperty("milkType")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(errors.GetProperty("amountMl")[0].GetString(), Is.EqualTo("outOfRange"));
        });
    }

    [Test]
    public async Task Solids_are_created_and_listed()
    {
        var id = Guid.NewGuid();

        var response = await _admin.PostAsJsonAsync("/api/feeds", new
        {
            id,
            babyId = _leaId,
            kind = "solids",
            startTime = _now.AddMinutes(-10),
            mealType = "lunch",
            food = "Carrot purée",
            reaction = "allergicReaction",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var feed = (await PageAsync(_admin)).GetProperty("entries")[0];
        Assert.Multiple(() =>
        {
            Assert.That(feed.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(feed.GetProperty("kind").GetString(), Is.EqualTo("solids"));
            Assert.That(feed.GetProperty("mealType").GetString(), Is.EqualTo("lunch"));
            Assert.That(feed.GetProperty("food").GetString(), Is.EqualTo("Carrot purée"));
            Assert.That(feed.GetProperty("reaction").GetString(), Is.EqualTo("allergicReaction"));
            Assert.That(feed.GetProperty("milkType").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(feed.GetProperty("amountMl").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task Invalid_solids_fields_answer_validation_codes()
    {
        var response = await _admin.PostAsJsonAsync("/api/feeds", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "solids",
            startTime = _now,
            mealType = "brunch",
            food = new string('a', 501),
            reaction = "meh",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.GetProperty("mealType")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(errors.GetProperty("food")[0].GetString(), Is.EqualTo("tooLong"));
            Assert.That(errors.GetProperty("reaction")[0].GetString(), Is.EqualTo("invalid"));
        });
    }

    [Test]
    public async Task Solids_are_edited()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/feeds", new { id, babyId = _leaId, kind = "solids", startTime = _now, mealType = "lunch", food = "Carrot" });

        var response = await _admin.PutAsJsonAsync($"/api/feeds/{id}", new { startTime = _now, food = "Pear", reaction = "liked" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var feed = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(feed.GetProperty("food").GetString(), Is.EqualTo("Pear"));
            Assert.That(feed.GetProperty("mealType").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(feed.GetProperty("reaction").GetString(), Is.EqualTo("liked"));
        });
    }

    [Test]
    public async Task A_feed_without_an_id_is_refused()
    {
        var response = await _admin.PostAsJsonAsync("/api/feeds", new { babyId = _leaId, kind = "bottle", startTime = _now, milkType = "formula", amountMl = 90 });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("id")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task A_feed_for_an_unknown_baby_is_not_found()
    {
        var response = await _admin.PostAsJsonAsync("/api/feeds", Bottle(babyId: Guid.NewGuid()));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await JsonAsync(response)).GetProperty("code").GetString(), Is.EqualTo("babyNotFound"));
    }

    [Test]
    public async Task Feeds_are_listed_newest_first_page_by_page()
    {
        for (var i = 0; i < 3; i++)
        {
            await _admin.PostAsJsonAsync("/api/feeds", Bottle(startTime: _now.AddHours(-i), amountMl: 100 + i));
        }

        var first = await PageAsync(_admin, "?limit=2");
        var next = first.GetProperty("next").GetString();
        var second = await PageAsync(_admin, $"?limit=2&cursor={Uri.EscapeDataString(next!)}");

        Assert.That(first.GetProperty("entries").EnumerateArray().Select(f => f.GetProperty("amountMl").GetInt32()), Is.EqualTo(new[] { 100, 101 }));
        Assert.That(second.GetProperty("entries").EnumerateArray().Select(f => f.GetProperty("amountMl").GetInt32()), Is.EqualTo(new[] { 102 }));
        Assert.That(second.GetProperty("next").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task A_malformed_cursor_is_a_validation_problem()
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/feeds?cursor=garbage");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("cursor")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task Listing_an_unknown_baby_is_not_found()
    {
        var response = await _admin.GetAsync($"/api/babies/{Guid.NewGuid()}/feeds");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await JsonAsync(response)).GetProperty("code").GetString(), Is.EqualTo("babyNotFound"));
    }

    [Test]
    public async Task Any_member_edits_any_feed_and_the_edit_records_who()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/feeds", Bottle(id, amountMl: 90));
        var (ben, _) = await RegisterBenAsync();

        var response = await ben.PutAsJsonAsync($"/api/feeds/{id}", new
        {
            startTime = _now.AddMinutes(-20),
            milkType = "breastMilk",
            amountMl = 110,
            notes = "more",
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var feed = await JsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(feed.GetProperty("amountMl").GetInt32(), Is.EqualTo(110));
            Assert.That(feed.GetProperty("milkType").GetString(), Is.EqualTo("breastMilk"));
            Assert.That(feed.GetProperty("kind").GetString(), Is.EqualTo("bottle"));
            Assert.That(feed.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Anna"));
            Assert.That(feed.GetProperty("updatedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        });
        ben.Dispose();
    }

    [Test]
    public async Task Editing_with_invalid_fields_is_a_validation_problem()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/feeds", Bottle(id));

        var response = await _admin.PutAsJsonAsync($"/api/feeds/{id}", new { startTime = _now, milkType = "formula", amountMl = 12.5 });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty("amountMl")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task Editing_an_unknown_feed_is_not_found()
    {
        var response = await _admin.PutAsJsonAsync($"/api/feeds/{Guid.NewGuid()}", new { startTime = _now, milkType = "formula", amountMl = 90 });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await JsonAsync(response)).GetProperty("code").GetString(), Is.EqualTo("feedNotFound"));
    }

    [Test]
    public async Task Any_member_deletes_any_feed()
    {
        var id = Guid.NewGuid();
        await _admin.PostAsJsonAsync("/api/feeds", Bottle(id));
        var (ben, _) = await RegisterBenAsync();

        Assert.That((await ben.DeleteAsync($"/api/feeds/{id}")).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        var again = await ben.DeleteAsync($"/api/feeds/{id}");

        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await JsonAsync(again)).GetProperty("code").GetString(), Is.EqualTo("feedNotFound"));
        Assert.That((await PageAsync(_admin)).GetProperty("entries").GetArrayLength(), Is.EqualTo(0));
        ben.Dispose();
    }

    [Test]
    public async Task Feeds_logged_by_a_deleted_account_still_show_its_display_name()
    {
        var (ben, _) = await RegisterBenAsync();
        await ben.PostAsJsonAsync("/api/feeds", Bottle());
        var deletion = await ben.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new { password = Password }) });
        Assert.That(deletion.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var feed = (await PageAsync(_admin)).GetProperty("entries")[0];

        Assert.That(feed.GetProperty("loggedBy").GetProperty("displayName").GetString(), Is.EqualTo("Ben"));
        ben.Dispose();
    }

    [Test]
    public async Task Bottle_defaults_give_the_last_milk_type_and_the_last_amount_of_each()
    {
        await _admin.PostAsJsonAsync("/api/feeds", Bottle(milkType: "formula", amountMl: 120, startTime: _now.AddHours(-2)));
        await _admin.PostAsJsonAsync("/api/feeds", Bottle(milkType: "breastMilk", amountMl: 90, startTime: _now.AddHours(-1)));

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/feeds/bottle-defaults");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var defaults = await JsonAsync(response);
        Assert.That(defaults.GetProperty("milkType").GetString(), Is.EqualTo("breastMilk"));
        Assert.That(defaults.GetProperty("lastAmountMl").GetProperty("breastMilk").GetInt32(), Is.EqualTo(90));
        Assert.That(defaults.GetProperty("lastAmountMl").GetProperty("formula").GetInt32(), Is.EqualTo(120));
    }

    [Test]
    public async Task Bottle_defaults_are_null_without_a_bottle()
    {
        var defaults = await JsonAsync(await _admin.GetAsync($"/api/babies/{_leaId}/feeds/bottle-defaults"));

        Assert.That(defaults.GetProperty("milkType").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(defaults.GetProperty("lastAmountMl").GetProperty("breastMilk").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(defaults.GetProperty("lastAmountMl").GetProperty("formula").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Feeds_need_a_session()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        Assert.That((await anonymous.GetAsync($"/api/babies/{_leaId}/feeds")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.PostAsJsonAsync("/api/feeds", Bottle())).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
