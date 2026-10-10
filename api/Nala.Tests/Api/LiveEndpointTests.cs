using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

/// <summary><c>GET /api/live</c>: every section's live entries in one call (spec 04 Live sync).</summary>
public class LiveEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
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
        _leaId = await AddBabyAsync("Lea");
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<Guid> AddBabyAsync(string name)
    {
        var response = await _admin.PostAsJsonAsync("/api/babies", new { name, birthDate = "2026-09-01" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        return (await JsonAsync(response)).GetProperty("id").GetGuid();
    }

    private async Task StartBreastfeedAsync(Guid id, Guid babyId, int minutesAgo)
    {
        var response = await _admin.PostAsJsonAsync(
            $"/api/feeds/{id}/breastfeed/start",
            new { babyId, segmentId = Guid.NewGuid(), side = "left", at = _now.AddMinutes(-minutesAgo) });
        Assert.That(response.IsSuccessStatusCode, Is.True);
    }

    private async Task StartSleepAsync(Guid id, Guid babyId, int minutesAgo)
    {
        var response = await _admin.PostAsJsonAsync($"/api/sleeps/{id}/start", new { babyId, at = _now.AddMinutes(-minutesAgo) });
        Assert.That(response.IsSuccessStatusCode, Is.True);
    }

    private async Task StartPumpAsync(Guid id, Guid babyId, int minutesAgo)
    {
        var response = await _admin.PostAsJsonAsync($"/api/pumps/{id}/start", new { babyId, at = _now.AddMinutes(-minutesAgo) });
        Assert.That(response.IsSuccessStatusCode, Is.True);
    }

    private async Task<JsonElement> LiveAsync()
    {
        var response = await _admin.GetAsync("/api/live");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return await JsonAsync(response);
    }

    private static IEnumerable<Guid> Ids(JsonElement live, string section) =>
        live.GetProperty(section).EnumerateArray().Select(e => e.GetProperty("id").GetGuid());

    [Test]
    public async Task Nothing_live_returns_empty_lists_per_section()
    {
        var live = await LiveAsync();

        Assert.That(live.GetProperty("feeds").GetArrayLength(), Is.Zero);
        Assert.That(live.GetProperty("sleeps").GetArrayLength(), Is.Zero);
        Assert.That(live.GetProperty("pumps").GetArrayLength(), Is.Zero);
    }

    [Test]
    public async Task Live_feeds_and_sleeps_of_every_baby_are_listed_oldest_first()
    {
        var tomId = await AddBabyAsync("Tom");
        var leaFeed = Guid.NewGuid();
        var tomFeed = Guid.NewGuid();
        var leaSleep = Guid.NewGuid();
        var tomSleep = Guid.NewGuid();
        await StartBreastfeedAsync(leaFeed, _leaId, minutesAgo: 5);
        await StartBreastfeedAsync(tomFeed, tomId, minutesAgo: 20);
        await StartSleepAsync(leaSleep, _leaId, minutesAgo: 40);
        await StartSleepAsync(tomSleep, tomId, minutesAgo: 10);

        var live = await LiveAsync();

        Assert.That(Ids(live, "feeds"), Is.EqualTo(new[] { tomFeed, leaFeed }));
        Assert.That(Ids(live, "sleeps"), Is.EqualTo(new[] { leaSleep, tomSleep }));
        var feed = live.GetProperty("feeds")[0];
        Assert.That(feed.GetProperty("babyId").GetGuid(), Is.EqualTo(tomId));
        Assert.That(feed.GetProperty("segments")[0].GetProperty("side").GetString(), Is.EqualTo("left"));
        var sleep = live.GetProperty("sleeps")[1];
        Assert.That(sleep.GetProperty("babyId").GetGuid(), Is.EqualTo(tomId));
        Assert.That(sleep.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Live_pumps_of_every_baby_are_listed_oldest_first_without_stopped_ones()
    {
        var tomId = await AddBabyAsync("Tom");
        var leaPump = Guid.NewGuid();
        var tomPump = Guid.NewGuid();
        var stopped = Guid.NewGuid();
        await StartPumpAsync(leaPump, _leaId, minutesAgo: 5);
        await StartPumpAsync(tomPump, tomId, minutesAgo: 20);
        await _admin.PostAsJsonAsync("/api/pumps", new
        {
            id = stopped,
            babyId = _leaId,
            startTime = _now.AddMinutes(-90),
            endTime = _now.AddMinutes(-70),
            leftMl = 60,
        });

        var live = await LiveAsync();

        Assert.That(Ids(live, "pumps"), Is.EqualTo(new[] { tomPump, leaPump }));
        var pump = live.GetProperty("pumps")[0];
        Assert.That(pump.GetProperty("babyId").GetGuid(), Is.EqualTo(tomId));
        Assert.That(pump.GetProperty("endTime").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Stopped_and_typed_entries_are_left_out()
    {
        var stoppedFeed = Guid.NewGuid();
        await StartBreastfeedAsync(stoppedFeed, _leaId, minutesAgo: 30);
        await _admin.PostAsJsonAsync($"/api/feeds/{stoppedFeed}/breastfeed/stop", new { at = _now.AddMinutes(-20) });
        await _admin.PostAsJsonAsync("/api/feeds", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "bottle",
            startTime = _now.AddMinutes(-10),
            milkType = "formula",
            amountMl = 120,
        });
        await _admin.PostAsJsonAsync("/api/sleeps", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            startTime = _now.AddMinutes(-120),
            endTime = _now.AddMinutes(-60),
        });
        var stoppedSleep = Guid.NewGuid();
        await StartSleepAsync(stoppedSleep, _leaId, minutesAgo: 15);
        await _admin.PostAsJsonAsync($"/api/sleeps/{stoppedSleep}/stop", new { at = _now });

        var live = await LiveAsync();

        Assert.That(live.GetProperty("feeds").GetArrayLength(), Is.Zero);
        Assert.That(live.GetProperty("sleeps").GetArrayLength(), Is.Zero);
    }

    [Test]
    public async Task Signed_out_is_unauthorized()
    {
        using var anonymous = _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await anonymous.GetAsync("/api/live");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task The_per_section_in_progress_endpoints_are_gone()
    {
        var feeds = await _admin.GetAsync("/api/feeds/in-progress");
        var sleeps = await _admin.GetAsync("/api/sleeps/in-progress");

        Assert.That(feeds.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(sleeps.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
    }
}
