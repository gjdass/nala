using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class TrendEndpointTests
{
    private const string Password = "correct horse battery";

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
    private Guid _leaId;

    [SetUp]
    public async Task SetUp()
    {
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(DateTimeOffset.UtcNow),
        };
        _admin = _factory.Start();

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        response = await TestBabies.PostAsync(_admin, new { name = "Lea", birthDate = "2026-09-01", birthWeightG = 3400 });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        _leaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    /// <summary>A Paris local time in September 2026 (UTC+2).</summary>
    private static DateTimeOffset At(int day, int hour, int minute = 0) => new(2026, 9, day, hour, minute, 0, TimeSpan.FromHours(2));

    private async Task AddSleepAsync(DateTimeOffset start, DateTimeOffset end)
    {
        var response = await _admin.PostAsJsonAsync("/api/sleeps", new { id = Guid.NewGuid(), babyId = _leaId, startTime = start.ToUniversalTime(), endTime = end.ToUniversalTime() });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
    }

    private async Task AddDiaperAsync(DateTimeOffset time, bool wet, bool dirty)
    {
        var response = await _admin.PostAsJsonAsync("/api/diapers", new { id = Guid.NewGuid(), babyId = _leaId, time = time.ToUniversalTime(), wet, dirty });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
    }

    private async Task AddPumpAsync(DateTimeOffset start, DateTimeOffset end, int? leftMl, int? rightMl)
    {
        var response = await _admin.PostAsJsonAsync("/api/pumps", new { id = Guid.NewGuid(), babyId = _leaId, startTime = start.ToUniversalTime(), endTime = end.ToUniversalTime(), leftMl, rightMl });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
    }

    private async Task AddBottleAsync(DateTimeOffset start, string milkType, int amountMl)
    {
        var response = await _admin.PostAsJsonAsync("/api/feeds", new { id = Guid.NewGuid(), babyId = _leaId, kind = "bottle", startTime = start.ToUniversalTime(), milkType, amountMl });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
    }

    private async Task AddBreastfeedAsync(DateTimeOffset start, int leftSeconds, int rightSeconds)
    {
        var response = await _admin.PostAsJsonAsync("/api/feeds", new
        {
            id = Guid.NewGuid(),
            babyId = _leaId,
            kind = "breastfeed",
            startTime = start.ToUniversalTime(),
            durations = new { leftSeconds, rightSeconds, endedOn = "right" },
        });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
    }

    private async Task AddGrowthAsync(object body)
    {
        var response = await _admin.PostAsJsonAsync("/api/growth-entries", body);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    [Test]
    public async Task Sleep_trends_return_the_data_days_aggregated_in_the_zone()
    {
        await AddSleepAsync(At(10, 13), At(10, 14, 30));
        await AddSleepAsync(At(10, 21), At(11, 6));
        await AddSleepAsync(At(20, 13), At(20, 14));

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/sleeps?from=2026-09-10&to=2026-09-16&tz=Europe/Paris");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var days = (await JsonAsync(response)).GetProperty("days");
        Assert.That(days.GetArrayLength(), Is.EqualTo(2));
        Assert.Multiple(() =>
        {
            Assert.That(days[0].GetProperty("date").GetString(), Is.EqualTo("2026-09-10"));
            Assert.That(days[0].GetProperty("daySeconds").GetInt64(), Is.EqualTo(5400));
            Assert.That(days[0].GetProperty("nightSeconds").GetInt64(), Is.EqualTo(3 * 3600));
            Assert.That(days[0].GetProperty("longestSeconds").GetInt64(), Is.EqualTo(9 * 3600));
            Assert.That(days[1].GetProperty("date").GetString(), Is.EqualTo("2026-09-11"));
            Assert.That(days[1].GetProperty("daySeconds").GetInt64(), Is.EqualTo(0));
            Assert.That(days[1].GetProperty("nightSeconds").GetInt64(), Is.EqualTo(6 * 3600));
            Assert.That(days[1].GetProperty("longestSeconds").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [Test]
    public async Task Diaper_trends_return_the_data_days_aggregated_in_the_zone()
    {
        await AddDiaperAsync(At(10, 8), wet: true, dirty: true);
        await AddDiaperAsync(At(10, 12), wet: false, dirty: false);
        await AddDiaperAsync(At(11, 0, 30), wet: true, dirty: false);
        await AddDiaperAsync(At(20, 9), wet: true, dirty: false);

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/diapers?from=2026-09-10&to=2026-09-16&tz=Europe/Paris");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var days = (await JsonAsync(response)).GetProperty("days");
        Assert.That(days.GetArrayLength(), Is.EqualTo(2));
        Assert.Multiple(() =>
        {
            Assert.That(days[0].GetProperty("date").GetString(), Is.EqualTo("2026-09-10"));
            Assert.That(days[0].GetProperty("wet").GetInt32(), Is.EqualTo(1));
            Assert.That(days[0].GetProperty("dirty").GetInt32(), Is.EqualTo(1));
            Assert.That(days[0].GetProperty("count").GetInt32(), Is.EqualTo(2));
            Assert.That(days[1].GetProperty("date").GetString(), Is.EqualTo("2026-09-11"));
            Assert.That(days[1].GetProperty("wet").GetInt32(), Is.EqualTo(1));
            Assert.That(days[1].GetProperty("dirty").GetInt32(), Is.EqualTo(0));
            Assert.That(days[1].GetProperty("count").GetInt32(), Is.EqualTo(1));
        });
    }

    [Test]
    public async Task Pump_trends_return_the_data_days_aggregated_in_the_zone()
    {
        await AddPumpAsync(At(10, 9), At(10, 9, 20), 90, 80);
        await AddPumpAsync(At(10, 23, 50), At(11, 0, 10), 60, null);
        await AddPumpAsync(At(20, 9), At(20, 9, 20), 50, 50);

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/pumps?from=2026-09-10&to=2026-09-16&tz=Europe/Paris");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var days = (await JsonAsync(response)).GetProperty("days");
        Assert.That(days.GetArrayLength(), Is.EqualTo(1));
        Assert.Multiple(() =>
        {
            Assert.That(days[0].GetProperty("date").GetString(), Is.EqualTo("2026-09-10"));
            Assert.That(days[0].GetProperty("leftMl").GetInt32(), Is.EqualTo(150));
            Assert.That(days[0].GetProperty("rightMl").GetInt32(), Is.EqualTo(80));
            Assert.That(days[0].GetProperty("sessions").GetInt32(), Is.EqualTo(2));
        });
    }

    [Test]
    public async Task Feed_trends_return_the_data_days_aggregated_in_the_zone()
    {
        await AddBreastfeedAsync(At(10, 8), 300, 420);
        await AddBottleAsync(At(10, 11), "formula", 120);
        await AddBottleAsync(At(20, 9), "breastMilk", 90);

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/feeds?from=2026-09-10&to=2026-09-16&tz=Europe/Paris");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var days = (await JsonAsync(response)).GetProperty("days");
        Assert.That(days.GetArrayLength(), Is.EqualTo(1));
        var day = days[0];
        Assert.Multiple(() =>
        {
            Assert.That(day.GetProperty("date").GetString(), Is.EqualTo("2026-09-10"));
            Assert.That(day.GetProperty("count").GetProperty("breastfeed").GetInt32(), Is.EqualTo(1));
            Assert.That(day.GetProperty("count").GetProperty("bottle").GetInt32(), Is.EqualTo(1));
            Assert.That(day.GetProperty("count").GetProperty("solids").GetInt32(), Is.EqualTo(0));
            Assert.That(day.GetProperty("bottleMl").GetProperty("breastMilk").GetInt32(), Is.EqualTo(0));
            Assert.That(day.GetProperty("bottleMl").GetProperty("formula").GetInt32(), Is.EqualTo(120));
            Assert.That(day.GetProperty("breastSeconds").GetProperty("left").GetInt64(), Is.EqualTo(300));
            Assert.That(day.GetProperty("breastSeconds").GetProperty("right").GetInt64(), Is.EqualTo(420));
            Assert.That(day.GetProperty("gapSecondsSum").GetInt64(), Is.EqualTo(3 * 3600));
            Assert.That(day.GetProperty("gapCount").GetInt32(), Is.EqualTo(1));
        });
    }

    [Test]
    public async Task Growth_trends_return_measurements_and_milestones()
    {
        await AddGrowthAsync(new { id = Guid.NewGuid(), babyId = _leaId, kind = "measurement", date = "2026-09-20", weightG = 4100, lengthCm = 54.5 });
        await AddGrowthAsync(new { id = Guid.NewGuid(), babyId = _leaId, kind = "measurement", date = "2026-10-20", weightG = 5100 });
        await AddGrowthAsync(new { id = Guid.NewGuid(), babyId = _leaId, kind = "milestone", date = "2026-09-25", milestone = "firstSmile" });

        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/growth?from=2026-09-01&to=2026-09-30");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var json = await JsonAsync(response);
        var measurements = json.GetProperty("measurements");
        var milestones = json.GetProperty("milestones");
        Assert.Multiple(() =>
        {
            Assert.That(measurements.GetArrayLength(), Is.EqualTo(2));
            Assert.That(measurements[0].GetProperty("date").GetString(), Is.EqualTo("2026-09-01"));
            Assert.That(measurements[0].GetProperty("weightG").GetInt32(), Is.EqualTo(3400));
            Assert.That(measurements[0].GetProperty("lengthCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(measurements[0].GetProperty("birth").GetBoolean(), Is.True);
            Assert.That(measurements[1].GetProperty("date").GetString(), Is.EqualTo("2026-09-20"));
            Assert.That(measurements[1].GetProperty("lengthCm").GetDecimal(), Is.EqualTo(54.5m));
            Assert.That(measurements[1].GetProperty("headCircumferenceCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
            Assert.That(measurements[1].GetProperty("birth").GetBoolean(), Is.False);
            Assert.That(milestones.GetArrayLength(), Is.EqualTo(1));
            Assert.That(milestones[0].GetProperty("date").GetString(), Is.EqualTo("2026-09-25"));
            Assert.That(milestones[0].GetProperty("milestone").GetString(), Is.EqualTo("firstSmile"));
            Assert.That(milestones[0].GetProperty("title").ValueKind, Is.EqualTo(JsonValueKind.Null));
        });
    }

    [TestCase("", "from", "required")]
    [TestCase("?from=2026-09-10", "to", "required")]
    [TestCase("?from=2026-9-10&to=2026-09-16", "from", "invalid")]
    [TestCase("?from=2026-09-10&to=nope", "to", "invalid")]
    [TestCase("?from=2026-09-10&to=2026-09-09", "to", "beforeFrom")]
    public async Task Growth_answers_the_from_and_to_codes(string query, string field, string code)
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/growth{query}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await JsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty(field)[0].GetString(), Is.EqualTo(code));
        Assert.That(errors.TryGetProperty("tz", out _), Is.False);
    }

    private static readonly string[] Sections = ["sleeps", "diapers", "pumps", "feeds", "growth"];

    private static readonly string[] BucketedSections = ["sleeps", "diapers", "pumps", "feeds"];

    private static IEnumerable<TestCaseData> InvalidQueries() =>
        from section in BucketedSections
        from data in new[]
        {
            ("", "from", "required"),
            ("?from=2026-09-10&to=2026-09-16", "tz", "required"),
            ("?from=2026-9-10&to=2026-09-16&tz=Europe/Paris", "from", "invalid"),
            ("?from=2026-09-10&to=nope&tz=Europe/Paris", "to", "invalid"),
            ("?from=2026-09-10&to=2026-09-09&tz=Europe/Paris", "to", "beforeFrom"),
            ("?from=2026-09-10&to=2026-09-16&tz=Mars/Olympus", "tz", "invalid"),
        }
        select new TestCaseData(section, data.Item1, data.Item2, data.Item3);

    [TestCaseSource(nameof(InvalidQueries))]
    public async Task Missing_or_invalid_parameters_answer_their_codes(string section, string query, string field, string code)
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/{section}{query}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty(field)[0].GetString(), Is.EqualTo(code));
    }

    [TestCaseSource(nameof(Sections))]
    public async Task Another_familys_baby_and_an_unknown_baby_answer_404(string section)
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        var query = $"trends/{section}?from=2026-09-10&to=2026-09-16&tz=Europe/Paris";

        foreach (var (client, babyId) in new[] { (carl.Client, _leaId), (_admin, Guid.NewGuid()) })
        {
            var response = await client.GetAsync($"/api/babies/{babyId}/{query}");

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That((await JsonAsync(response)).GetProperty("code").GetString(), Is.EqualTo("babyNotFound"));
        }
    }
}
