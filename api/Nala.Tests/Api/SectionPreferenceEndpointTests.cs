using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class SectionPreferenceEndpointTests
{
    private const string Password = "correct horse battery";
    private const string Url = "/api/account/sections";

    private static readonly string[] DefaultOrder = ["feed", "sleep", "diaper", "pump", "growth", "health"];

    private NalaApiFactory _factory = null!;
    private HttpClient _admin = null!;
    private Guid _annaId;

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
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _annaId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    /// <summary>Ben joins through an invitation seeded from Anna and is signed in on the returned client.</summary>
    private async Task<(HttpClient Client, Guid Id)> RegisterBenAsync()
    {
        var token = LinkToken.Generate();
        var now = _factory.Time!.GetUtcNow();
        using (var scope = _factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
            {
                Id = Guid.NewGuid(),
                TokenHash = LinkToken.Hash(token),
                CreatedByUserId = _annaId,
                CreatedAt = now,
                ExpiresAt = now + InvitationPolicy.Lifetime,
            });
        }

        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("user").GetProperty("id").GetGuid();
        return (client, id);
    }

    private static async Task<(string Key, bool Visible)[]> GetAsync(HttpClient client)
    {
        var response = await client.GetAsync(Url);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return ToTuples(await response.Content.ReadFromJsonAsync<JsonElement>());
    }

    private static (string Key, bool Visible)[] ToTuples(JsonElement list) =>
        list.EnumerateArray()
            .Select(s => (s.GetProperty("key").GetString()!, s.GetProperty("visible").GetBoolean()))
            .ToArray();

    private static Task<HttpResponseMessage> PutAsync(HttpClient client, IEnumerable<(string Key, bool Visible)> sections) =>
        client.PutAsJsonAsync(Url, sections.Select(s => new { key = s.Key, visible = s.Visible }));

    private static readonly (string Key, bool Visible)[] Custom =
    [
        ("pump", true), ("feed", true), ("sleep", false), ("diaper", true), ("growth", true), ("health", false),
    ];

    [Test]
    public async Task A_new_user_gets_the_default_order()
    {
        Assert.That(await GetAsync(_admin), Is.EqualTo(DefaultOrder.Select(k => (k, true))));
    }

    [Test]
    public async Task Saved_preferences_are_returned_on_another_device()
    {
        var response = await PutAsync(_admin, Custom);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(ToTuples(await response.Content.ReadFromJsonAsync<JsonElement>()), Is.EqualTo(Custom));

        using var otherDevice = NewClient();
        Assert.That(
            (await otherDevice.PostAsJsonAsync("/api/auth/login", new { email = "anna@mail.com", password = Password })).StatusCode,
            Is.EqualTo(HttpStatusCode.OK));
        Assert.That(await GetAsync(otherDevice), Is.EqualTo(Custom));
    }

    [Test]
    public async Task Saving_does_not_change_another_members_preferences()
    {
        var (ben, _) = await RegisterBenAsync();

        Assert.That((await PutAsync(_admin, Custom)).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        Assert.That(await GetAsync(ben), Is.EqualTo(DefaultOrder.Select(k => (k, true))));
        ben.Dispose();
    }

    private static IEnumerable<TestCaseData> InvalidLists()
    {
        yield return new TestCaseData(DefaultOrder.Take(5).ToArray(), true, "invalid").SetName("A_missing_key_is_refused");
        yield return new TestCaseData(DefaultOrder.Append("feed").ToArray(), true, "invalid").SetName("A_duplicate_key_is_refused");
        yield return new TestCaseData(DefaultOrder.Append("bath").ToArray(), true, "invalid").SetName("An_unknown_key_is_refused");
        yield return new TestCaseData(DefaultOrder, false, "noneVisible").SetName("A_list_with_no_visible_section_is_refused");
    }

    [TestCaseSource(nameof(InvalidLists))]
    public async Task Invalid_lists_are_refused_with_a_validation_problem(string[] keys, bool visible, string code)
    {
        var response = await PutAsync(_admin, keys.Select(k => (k, visible)));

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("sections")[0].GetString(), Is.EqualTo(code));
        Assert.That(await GetAsync(_admin), Is.EqualTo(DefaultOrder.Select(k => (k, true))), "nothing saved");
    }

    [Test]
    public async Task Anonymous_requests_are_refused()
    {
        using var anonymous = NewClient();

        Assert.That((await anonymous.GetAsync(Url)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await PutAsync(anonymous, Custom)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task A_disabled_member_is_refused()
    {
        var (ben, benId) = await RegisterBenAsync();
        Assert.That(
            (await _admin.PostAsync($"/api/admin/users/{benId}/disable", null)).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        Assert.That((await ben.GetAsync(Url)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await PutAsync(ben, Custom)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        ben.Dispose();
    }
}
