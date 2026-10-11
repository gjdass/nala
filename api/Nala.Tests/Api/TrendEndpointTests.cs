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

    /// <summary>A Paris local time in September 2026 (UTC+2).</summary>
    private static DateTimeOffset At(int day, int hour, int minute = 0) => new(2026, 9, day, hour, minute, 0, TimeSpan.FromHours(2));

    private async Task AddSleepAsync(DateTimeOffset start, DateTimeOffset end)
    {
        var response = await _admin.PostAsJsonAsync("/api/sleeps", new { id = Guid.NewGuid(), babyId = _leaId, startTime = start.ToUniversalTime(), endTime = end.ToUniversalTime() });
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

    [TestCase("", "from", "required")]
    [TestCase("?from=2026-09-10&to=2026-09-16", "tz", "required")]
    [TestCase("?from=2026-9-10&to=2026-09-16&tz=Europe/Paris", "from", "invalid")]
    [TestCase("?from=2026-09-10&to=nope&tz=Europe/Paris", "to", "invalid")]
    [TestCase("?from=2026-09-10&to=2026-09-09&tz=Europe/Paris", "to", "beforeFrom")]
    [TestCase("?from=2026-09-10&to=2026-09-16&tz=Mars/Olympus", "tz", "invalid")]
    public async Task Missing_or_invalid_parameters_answer_their_codes(string query, string field, string code)
    {
        var response = await _admin.GetAsync($"/api/babies/{_leaId}/trends/sleeps{query}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That((await JsonAsync(response)).GetProperty("errors").GetProperty(field)[0].GetString(), Is.EqualTo(code));
    }

    [Test]
    public async Task Another_familys_baby_and_an_unknown_baby_answer_404()
    {
        using var carl = await OtherFamily.CreateAsync(_factory);
        const string query = "trends/sleeps?from=2026-09-10&to=2026-09-16&tz=Europe/Paris";

        foreach (var (client, babyId) in new[] { (carl.Client, _leaId), (_admin, Guid.NewGuid()) })
        {
            var response = await client.GetAsync($"/api/babies/{babyId}/{query}");

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That((await JsonAsync(response)).GetProperty("code").GetString(), Is.EqualTo("babyNotFound"));
        }
    }
}
