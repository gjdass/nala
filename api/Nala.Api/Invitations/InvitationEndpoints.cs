using Nala.Api.Auth;
using Nala.Api.Email;
using Nala.Core.Invitations;

namespace Nala.Api.Invitations;

/// <summary>The web builds the link <c>/invite/{token}</c> from it.</summary>
public sealed record CreatedInvitationResponse(string Token, DateTimeOffset ExpiresAt);

public sealed record SendInvitationRequest(string? Email);

public sealed record SentInvitationResponse(DateTimeOffset ExpiresAt);

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
        invitations.MapPost("/email", SendByEmailAsync);
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

    /// <summary>202 once the email is queued; 404 when SMTP is off; 400 validation problem.</summary>
    private static async Task<IResult> SendByEmailAsync(
        SendInvitationRequest request,
        InvitationService invitations,
        EmailOptions email,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        if (!email.Enabled)
        {
            return Results.Json(new ErrorResponse("emailInviteDisabled"), statusCode: StatusCodes.Status404NotFound);
        }

        return await invitations.SendByEmailAsync(
                AuthEndpoints.CurrentUser(context)!, request.Email, email.PublicUrl!, cancellationToken) switch
        {
            SendInvitationResult.Sent sent => Results.Accepted(value: new SentInvitationResponse(sent.ExpiresAt)),
            SendInvitationResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            _ => throw new InvalidOperationException("Unexpected result."),
        };
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
