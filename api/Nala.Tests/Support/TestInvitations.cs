using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Families;
using Nala.Core.Invitations;

namespace Nala.Tests.Support;

/// <summary>Seeds invitations straight into the database of an API under test.</summary>
public static class TestInvitations
{
    /// <summary>A join invitation from <paramref name="createdBy"/> to their only family, created now; returns its token.</summary>
    public static async Task<string> SeedJoinAsync(NalaApiFactory factory, Guid createdBy)
    {
        var token = LinkToken.Generate();
        var now = factory.Time!.GetUtcNow();
        using var scope = factory.Services.CreateScope();
        var family = (await scope.ServiceProvider.GetRequiredService<IFamilyRepository>().ListForUserAsync(createdBy)).Single();
        await scope.ServiceProvider.GetRequiredService<IInvitationRepository>().AddAsync(new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            FamilyId = family.Family.Id,
            CreatedByUserId = createdBy,
            CreatedAt = now,
            ExpiresAt = now + InvitationPolicy.Lifetime,
        });
        return token;
    }
}
