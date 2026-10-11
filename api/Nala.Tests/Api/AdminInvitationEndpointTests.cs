using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Email;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

/// <summary>New-family invitations (spec 02): the instance admin's only, under <c>/api/admin/invitations</c>.</summary>
public class AdminInvitationEndpointTests
{
    private const string Password = "correct horse battery";
    private const string Invitations = "/api/admin/invitations";

    private NalaApiFactory _factory = null!;
    private CapturingEmailSender _sender = null!;
    private HttpClient _admin = null!;
    private Guid _familyId;

    /// <summary>Anna sets the instance up and stays signed in on <see cref="_admin"/>.</summary>
    private async Task StartAsync(bool smtp = false)
    {
        _sender = new CapturingEmailSender();
        // Real "now": the test client's cookie container drops cookies whose expiry is in the real past.
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container))
        {
            Time = new FixedTimeProvider(DateTimeOffset.UtcNow),
            Settings = smtp ? ForgotPasswordEndpointTests.SmtpSettings : new Dictionary<string, string?>(),
            ServiceOverrides = services => services.AddSingleton<IEmailSender>(_sender),
        };
        _admin = _factory.Start();

        var response = await _admin.PostAsJsonAsync(
            "/api/auth/setup", new { email = "anna@mail.com", displayName = "Anna", password = Password, language = "en", familyName = "Martins" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        _familyId = (await _admin.GetFromJsonAsync<JsonElement[]>("/api/families"))!.Single().GetProperty("id").GetGuid();
    }

    [TearDown]
    public async Task TearDown()
    {
        _admin.Dispose();
        await _factory.DisposeAsync();
    }

    private HttpClient NewClient() => _factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

    private static async Task<string> CreateAsync(HttpClient client)
    {
        var response = await client.PostAsync(Invitations, null);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    /// <summary>Ben joins Anna's family through a join invitation and is signed in on the returned client.</summary>
    private async Task<HttpClient> BenAsync()
    {
        var created = await _admin.PostAsync($"/api/families/{_familyId}/invitations", null);
        var token = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        var ben = NewClient();
        var response = await ben.PostAsJsonAsync(
            $"/api/auth/invitations/{token}/register",
            new { email = "ben@mail.com", displayName = "Ben", password = Password, language = "en" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return ben;
    }

    [Test]
    public async Task Admin_creates_a_new_family_link_valid_7_days()
    {
        await StartAsync();

        var response = await _admin.PostAsync(Invitations, null);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(
            body.GetProperty("expiresAt").GetDateTimeOffset(),
            Is.EqualTo(_factory.Time!.GetUtcNow().AddDays(7)).Within(TimeSpan.FromSeconds(1)));
        var lookup = await NewClient().GetFromJsonAsync<JsonElement>($"/api/auth/invitations/{body.GetProperty("token").GetString()}");
        Assert.That(lookup.GetProperty("kind").GetString(), Is.EqualTo("newFamily"));
        Assert.That(lookup.GetProperty("familyName").ValueKind, Is.EqualTo(JsonValueKind.Null));
        Assert.That(lookup.GetProperty("invitedBy").GetString(), Is.EqualTo("Anna"));
    }

    [Test]
    public async Task Admin_lists_only_new_family_invitations_and_revokes_them()
    {
        await StartAsync();
        var token = await CreateAsync(_admin);
        await _admin.PostAsync($"/api/families/{_familyId}/invitations", null);

        var pending = await _admin.GetFromJsonAsync<JsonElement[]>(Invitations);

        Assert.That(pending, Has.Length.EqualTo(1));
        Assert.That(pending![0].GetProperty("createdBy").GetString(), Is.EqualTo("Anna"));
        var id = pending[0].GetProperty("id").GetGuid();
        Assert.That((await _admin.PostAsync($"{Invitations}/{id}/revoke", null)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That((await _admin.PostAsync($"{Invitations}/{id}/revoke", null)).StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(await _admin.GetFromJsonAsync<JsonElement[]>(Invitations), Is.Empty);
        var lookup = await NewClient().GetAsync($"/api/auth/invitations/{token}");
        Assert.That(lookup.StatusCode, Is.EqualTo(HttpStatusCode.Gone));
        Assert.That(await CodeAsync(lookup), Is.EqualTo("invitationRevoked"));
    }

    [Test]
    public async Task Revoking_a_join_invitation_as_a_new_family_one_is_unknown()
    {
        await StartAsync();
        await _admin.PostAsync($"/api/families/{_familyId}/invitations", null);
        var joinId = (await _admin.GetFromJsonAsync<JsonElement[]>($"/api/families/{_familyId}/invitations"))!
            .Single().GetProperty("id").GetGuid();

        foreach (var id in new[] { joinId, Guid.NewGuid() })
        {
            var response = await _admin.PostAsync($"{Invitations}/{id}/revoke", null);
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(await CodeAsync(response), Is.EqualTo("invitationUnknown"));
        }
    }

    [Test]
    public async Task Email_invitation_returns_202_and_the_emailed_link_creates_a_family()
    {
        await StartAsync(smtp: true);

        var response = await _admin.PostAsJsonAsync($"{Invitations}/email", new { email = "carl@mail.com" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Accepted));
        var message = await _sender.NextAsync();
        Assert.That(message.To, Is.EqualTo("carl@mail.com"));
        Assert.That(message.Body, Does.Contain("create your family"));
        Assert.That(await _admin.GetFromJsonAsync<JsonElement[]>(Invitations), Has.Length.EqualTo(1));
    }

    [Test]
    public async Task Email_invitation_accepts_a_member_of_the_admins_family()
    {
        await StartAsync(smtp: true);
        using var ben = await BenAsync();

        var response = await _admin.PostAsJsonAsync($"{Invitations}/email", new { email = "ben@mail.com" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Accepted));
    }

    [Test]
    public async Task Email_invitation_is_404_when_smtp_is_off()
    {
        await StartAsync(smtp: false);

        var off = await _admin.PostAsJsonAsync($"{Invitations}/email", new { email = "carl@mail.com" });
        Assert.That(off.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await CodeAsync(off), Is.EqualTo("emailInviteDisabled"));
    }

    [Test]
    public async Task Email_invitation_with_a_bad_address_is_a_validation_problem()
    {
        await StartAsync(smtp: true);

        var response = await _admin.PostAsJsonAsync($"{Invitations}/email", new { email = "nope" });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.That(errors.GetProperty("email")[0].GetString(), Is.EqualTo("invalid"));
    }

    [Test]
    public async Task Non_admin_gets_403_admin_only_on_every_new_family_invitation_endpoint()
    {
        await StartAsync(smtp: true);
        await CreateAsync(_admin);
        var id = (await _admin.GetFromJsonAsync<JsonElement[]>(Invitations))!.Single().GetProperty("id").GetGuid();
        using var ben = await BenAsync();

        foreach (var response in new[]
                 {
                     await ben.PostAsync(Invitations, null),
                     await ben.PostAsJsonAsync($"{Invitations}/email", new { email = "carl@mail.com" }),
                     await ben.GetAsync(Invitations),
                     await ben.PostAsync($"{Invitations}/{id}/revoke", null),
                 })
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
            Assert.That(await CodeAsync(response), Is.EqualTo("adminOnly"));
        }

        Assert.That(await _admin.GetFromJsonAsync<JsonElement[]>(Invitations), Has.Length.EqualTo(1));
    }

    [Test]
    public async Task New_family_invitation_endpoints_need_a_session()
    {
        await StartAsync();
        using var anonymous = NewClient();

        Assert.That((await anonymous.PostAsync(Invitations, null)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That((await anonymous.GetAsync(Invitations)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(
            (await anonymous.PostAsJsonAsync($"{Invitations}/email", new { email = "x@mail.com" })).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(
            (await anonymous.PostAsync($"{Invitations}/{Guid.NewGuid()}/revoke", null)).StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
    }
}
