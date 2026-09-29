using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class BabyEndpointTests
{
    private const string Password = "correct horse battery";

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

        // The admin, signed in on _admin by setup.
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

    private static Task<HttpResponseMessage> AddAsync(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/babies", body);

    private static async Task<JsonElement[]> ListAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/babies");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    [Test]
    public async Task No_baby_at_first()
    {
        Assert.That(await ListAsync(_admin), Is.Empty);
    }

    [Test]
    public async Task Admin_adds_a_baby_with_every_field()
    {
        var response = await AddAsync(_admin, new
        {
            name = " Lea ",
            birthDate = "2026-09-01",
            sex = "girl",
            birthWeightG = 3400,
            birthLengthCm = 50.5,
            birthHeadCircumferenceCm = 34.5,
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var baby = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Multiple(() =>
        {
            Assert.That(baby.GetProperty("id").GetGuid(), Is.Not.EqualTo(Guid.Empty));
            Assert.That(baby.GetProperty("name").GetString(), Is.EqualTo("Lea"));
            Assert.That(baby.GetProperty("birthDate").GetString(), Is.EqualTo("2026-09-01"));
            Assert.That(baby.GetProperty("sex").GetString(), Is.EqualTo("girl"));
            Assert.That(baby.GetProperty("birthWeightG").GetInt32(), Is.EqualTo(3400));
            Assert.That(baby.GetProperty("birthLengthCm").GetDecimal(), Is.EqualTo(50.5m));
            Assert.That(baby.GetProperty("birthHeadCircumferenceCm").GetDecimal(), Is.EqualTo(34.5m));
        });
    }

    [Test]
    public async Task Sex_defaults_to_unspecified_and_measurements_to_null()
    {
        var response = await AddAsync(_admin, new { name = "Lea", birthDate = "2026-09-01" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        var baby = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(baby.GetProperty("sex").GetString(), Is.EqualTo("unspecified"));
        Assert.That(baby.GetProperty("birthWeightG").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(baby.GetProperty("birthLengthCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(baby.GetProperty("birthHeadCircumferenceCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task A_member_adds_a_baby_every_member_sees()
    {
        var (ben, _) = await RegisterBenAsync();

        var response = await AddAsync(ben, new { name = "Lea", birthDate = "2026-09-01" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        Assert.That((await ListAsync(_admin)).Select(b => b.GetProperty("name").GetString()), Is.EqualTo(new[] { "Lea" }));
        ben.Dispose();
    }

    [Test]
    public async Task Invalid_fields_answer_a_validation_problem_with_codes()
    {
        var tomorrowEverywhere = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)).ToString("yyyy-MM-dd");

        var response = await AddAsync(_admin, new
        {
            name = "",
            birthDate = tomorrowEverywhere,
            sex = "other",
            birthWeightG = 3400.5,
            birthLengthCm = 90,
            birthHeadCircumferenceCm = 34.55,
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(errors.GetProperty("name")[0].GetString(), Is.EqualTo("required"));
            Assert.That(errors.GetProperty("birthDate")[0].GetString(), Is.EqualTo("inFuture"));
            Assert.That(errors.GetProperty("sex")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(errors.GetProperty("birthWeightG")[0].GetString(), Is.EqualTo("invalid"));
            Assert.That(errors.GetProperty("birthLengthCm")[0].GetString(), Is.EqualTo("outOfRange"));
            Assert.That(errors.GetProperty("birthHeadCircumferenceCm")[0].GetString(), Is.EqualTo("invalid"));
        });
        Assert.That(await ListAsync(_admin), Is.Empty);
    }

    [Test]
    public async Task Missing_birth_date_is_required()
    {
        var response = await AddAsync(_admin, new { name = "Lea" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("birthDate")[0].GetString(), Is.EqualTo("required"));
    }

    [Test]
    public async Task Babies_are_listed_oldest_first()
    {
        await AddAsync(_admin, new { name = "Lea", birthDate = "2026-09-01" });
        await AddAsync(_admin, new { name = "Tom", birthDate = "2024-03-01" });

        var names = (await ListAsync(_admin)).Select(b => b.GetProperty("name").GetString());

        Assert.That(names, Is.EqualTo(new[] { "Tom", "Lea" }));
    }

    [Test]
    public async Task Babies_need_a_session()
    {
        using var anonymous = NewClient();

        Assert.That((await anonymous.GetAsync("/api/babies")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(
            (await AddAsync(anonymous, new { name = "Lea", birthDate = "2026-09-01" })).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task A_disabled_member_is_refused()
    {
        var (ben, benId) = await RegisterBenAsync();
        Assert.That(
            (await _admin.PostAsync($"/api/admin/users/{benId}/disable", null)).StatusCode, Is.EqualTo(HttpStatusCode.OK));

        Assert.That((await ben.GetAsync("/api/babies")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(
            (await AddAsync(ben, new { name = "Lea", birthDate = "2026-09-01" })).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(
            (await EditAsync(ben, Guid.NewGuid(), new { name = "Lea", birthDate = "2026-09-01" })).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
        ben.Dispose();
    }

    private static Task<HttpResponseMessage> EditAsync(HttpClient client, Guid id, object body) =>
        client.PutAsJsonAsync($"/api/babies/{id}", body);

    private async Task<Guid> AddLeaAsync()
    {
        var response = await AddAsync(_admin, new
        {
            name = "Lea",
            birthDate = "2026-09-01",
            sex = "girl",
            birthWeightG = 3400,
            birthLengthCm = 50.5,
            birthHeadCircumferenceCm = 34.5,
        });
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    [Test]
    public async Task A_member_edits_a_baby_someone_else_added()
    {
        var id = await AddLeaAsync();
        var (ben, _) = await RegisterBenAsync();

        var response = await EditAsync(ben, id, new
        {
            name = " Léa ",
            birthDate = "2026-08-31",
            sex = "boy",
            birthWeightG = 3500,
            birthLengthCm = 51,
            birthHeadCircumferenceCm = 35.5,
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var baby = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Multiple(() =>
        {
            Assert.That(baby.GetProperty("id").GetGuid(), Is.EqualTo(id));
            Assert.That(baby.GetProperty("name").GetString(), Is.EqualTo("Léa"));
            Assert.That(baby.GetProperty("birthDate").GetString(), Is.EqualTo("2026-08-31"));
            Assert.That(baby.GetProperty("sex").GetString(), Is.EqualTo("boy"));
            Assert.That(baby.GetProperty("birthWeightG").GetInt32(), Is.EqualTo(3500));
            Assert.That(baby.GetProperty("birthLengthCm").GetDecimal(), Is.EqualTo(51m));
            Assert.That(baby.GetProperty("birthHeadCircumferenceCm").GetDecimal(), Is.EqualTo(35.5m));
        });
        Assert.That((await ListAsync(_admin)).Single().GetProperty("name").GetString(), Is.EqualTo("Léa"));
        ben.Dispose();
    }

    [Test]
    public async Task Edit_replaces_every_field_so_omitted_measurements_are_cleared()
    {
        var id = await AddLeaAsync();

        var response = await EditAsync(_admin, id, new { name = "Lea", birthDate = "2026-09-01" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var baby = (await ListAsync(_admin)).Single();
        Assert.That(baby.GetProperty("sex").GetString(), Is.EqualTo("unspecified"));
        Assert.That(baby.GetProperty("birthWeightG").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(baby.GetProperty("birthLengthCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(baby.GetProperty("birthHeadCircumferenceCm").ValueKind, Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task Invalid_edit_answers_a_validation_problem_and_changes_nothing()
    {
        var id = await AddLeaAsync();

        var response = await EditAsync(_admin, id, new { name = new string('a', 51), birthDate = "2026-09-01", birthWeightG = 100 });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("name")[0].GetString(), Is.EqualTo("tooLong"));
        Assert.That(errors.GetProperty("birthWeightG")[0].GetString(), Is.EqualTo("outOfRange"));
        Assert.That((await ListAsync(_admin)).Single().GetProperty("name").GetString(), Is.EqualTo("Lea"));
    }

    [Test]
    public async Task Editing_an_unknown_baby_is_not_found()
    {
        var response = await EditAsync(_admin, Guid.NewGuid(), new { name = "Lea", birthDate = "2026-09-01" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString(), Is.EqualTo("babyNotFound"));
    }

    [Test]
    public async Task Editing_needs_a_session()
    {
        var id = await AddLeaAsync();
        using var anonymous = NewClient();

        Assert.That(
            (await EditAsync(anonymous, id, new { name = "Lea", birthDate = "2026-09-01" })).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
