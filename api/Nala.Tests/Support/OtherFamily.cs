using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using NUnit.Framework;
using Nala.Core.Auth;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Tests.Support;

/// <summary>Another family on the instance, administered by Carl, for isolation tests (spec 03).</summary>
public sealed record OtherFamily(HttpClient Client, Guid UserId, Guid FamilyId) : IDisposable
{
    public const string Password = "carl's own password";

    /// <summary>Seeds Carl and his family "Others" straight in the database, and signs him in on a new client.</summary>
    public static async Task<OtherFamily> CreateAsync(NalaApiFactory factory)
    {
        var now = factory.Time?.GetUtcNow() ?? DateTimeOffset.UtcNow;
        var carl = new User { Id = Guid.NewGuid(), Email = "carl@mail.com", DisplayName = "Carl", PreferredLanguage = "en", CreatedAt = now };
        var family = new Family { Id = Guid.NewGuid(), Name = "Others", CreatedByUserId = carl.Id, CreatedAt = now };
        using (var scope = factory.Services.CreateScope())
        {
            carl.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher>().Hash(Password);
            await scope.ServiceProvider.GetRequiredService<IFamilyRepository>().AddWithNewAdminAsync(
                carl, family, new Membership { FamilyId = family.Id, UserId = carl.Id, Role = FamilyRole.Admin, JoinedAt = now });
        }

        var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "carl@mail.com", password = Password });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return new OtherFamily(client, carl.Id, family.Id);
    }

    public void Dispose() => Client.Dispose();
}
