using Nala.Api.Families;
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

/// <summary>
/// Join invitations to a family. Any of its members may create, list and revoke them (fallback session policy);
/// for anyone else the family is 404 <c>familyNotFound</c>.
/// </summary>
public static class InvitationEndpoints
{
    public static IServiceCollection AddNalaInvitations(this IServiceCollection services) =>
        services.AddScoped<InvitationService>();

    public static IEndpointRouteBuilder MapNalaInvitations(this IEndpointRouteBuilder endpoints)
    {
        var invitations = endpoints.MapGroup("/api/families/{familyId:guid}/invitations");
        invitations.MapPost("", CreateAsync);
        invitations.MapPost("/email", SendByEmailAsync);
        invitations.MapGet("", ListAsync);
        invitations.MapPost("/{id:guid}/revoke", RevokeAsync);
        return endpoints;
    }

    private static async Task<IResult> CreateAsync(
        Guid familyId, InvitationService invitations, HttpContext context, CancellationToken cancellationToken) =>
        await invitations.CreateAsync(AuthEndpoints.CurrentUser(context)!, familyId, cancellationToken) switch
        {
            CreateInvitationResult.Created created =>
                Results.Ok(new CreatedInvitationResponse(created.Invitation.Token, created.Invitation.ExpiresAt)),
            _ => FamilyEndpoints.FamilyNotFound(),
        };

    /// <summary>202 once the email is queued; 404 for the family, then when SMTP is off; 400 validation problem.</summary>
    private static async Task<IResult> SendByEmailAsync(
        Guid familyId,
        SendInvitationRequest request,
        InvitationService invitations,
        EmailOptions email,
        HttpContext context,
        CancellationToken cancellationToken) =>
        await invitations.SendByEmailAsync(
                AuthEndpoints.CurrentUser(context)!,
                familyId,
                request.Email,
                email.Enabled ? email.PublicUrl : null,
                cancellationToken) switch
        {
            SendInvitationResult.Sent sent => Results.Accepted(value: new SentInvitationResponse(sent.ExpiresAt)),
            SendInvitationResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            SendInvitationResult.Disabled =>
                Results.Json(new ErrorResponse("emailInviteDisabled"), statusCode: StatusCodes.Status404NotFound),
            _ => FamilyEndpoints.FamilyNotFound(),
        };

    private static async Task<IResult> ListAsync(
        Guid familyId, InvitationService invitations, HttpContext context, CancellationToken cancellationToken) =>
        await invitations.ListPendingAsync(AuthEndpoints.CurrentUser(context)!, familyId, cancellationToken) is { } pending
            ? Results.Ok(pending.Select(i => new PendingInvitationResponse(i.Id, i.CreatedBy, i.CreatedAt, i.ExpiresAt)))
            : FamilyEndpoints.FamilyNotFound();

    /// <summary>204 when revoked (now or before); 410 when used or expired; 404 for the family, then the invitation.</summary>
    private static async Task<IResult> RevokeAsync(
        Guid familyId, Guid id, InvitationService invitations, HttpContext context, CancellationToken cancellationToken) =>
        await invitations.RevokeAsync(AuthEndpoints.CurrentUser(context)!, familyId, id, cancellationToken) switch
        {
            RevokeInvitationResult.Revoked => Results.NoContent(),
            RevokeInvitationResult.Unavailable unavailable => AuthEndpoints.InvitationUnavailable(unavailable.Problem),
            RevokeInvitationResult.FamilyNotFound => FamilyEndpoints.FamilyNotFound(),
            _ => AuthEndpoints.InvitationUnavailable(InvitationProblem.Unknown),
        };
}
