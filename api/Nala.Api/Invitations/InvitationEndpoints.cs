using Nala.Api.Auth;
using Nala.Core.Invitations;

namespace Nala.Api.Invitations;

/// <summary>The web builds the link <c>/invite/{token}</c> from it.</summary>
public sealed record CreatedInvitationResponse(string Token, DateTimeOffset ExpiresAt);

/// <summary><c>CreatedBy</c> is the creator's display name.</summary>
public sealed record PendingInvitationResponse(Guid Id, string CreatedBy, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

/// <summary>Invitation links. Every member may create, list and revoke them (fallback session policy).</summary>
public static class InvitationEndpoints
{
    public static IServiceCollection AddNalaInvitations(this IServiceCollection services) =>
        services.AddScoped<InvitationService>();

    public static IEndpointRouteBuilder MapNalaInvitations(this IEndpointRouteBuilder endpoints)
    {
        var invitations = endpoints.MapGroup("/api/invitations");
        invitations.MapPost("", CreateAsync);
        invitations.MapGet("", ListAsync);
        invitations.MapPost("/{id:guid}/revoke", RevokeAsync);
        return endpoints;
    }

    private static async Task<IResult> CreateAsync(
        InvitationService invitations, HttpContext context, CancellationToken cancellationToken)
    {
        var created = await invitations.CreateAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken);
        return Results.Ok(new CreatedInvitationResponse(created.Token, created.ExpiresAt));
    }

    private static async Task<IResult> ListAsync(InvitationService invitations, CancellationToken cancellationToken) =>
        Results.Ok((await invitations.ListPendingAsync(cancellationToken))
            .Select(i => new PendingInvitationResponse(i.Id, i.CreatedBy, i.CreatedAt, i.ExpiresAt)));

    /// <summary>204 when revoked (now or before); 410 when used or expired; 404 when unknown.</summary>
    private static async Task<IResult> RevokeAsync(Guid id, InvitationService invitations, CancellationToken cancellationToken) =>
        await invitations.RevokeAsync(id, cancellationToken) switch
        {
            RevokeInvitationResult.Revoked => Results.NoContent(),
            RevokeInvitationResult.Unavailable unavailable => AuthEndpoints.InvitationUnavailable(unavailable.Problem),
            _ => AuthEndpoints.InvitationUnavailable(InvitationProblem.Unknown),
        };
}
