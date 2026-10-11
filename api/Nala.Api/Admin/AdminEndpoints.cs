using Nala.Api.Auth;
using Nala.Api.Email;
using Nala.Api.Invitations;
using Nala.Core.Admin;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Api.Admin;

/// <summary>An account as the instance admin sees it: no family data.</summary>
public sealed record AdminUserResponse(Guid Id, string DisplayName, string Email, bool IsAdmin, DateTimeOffset? LastActivityAt);

/// <summary>The web builds the link <c>/reset/{token}</c> from it.</summary>
public sealed record ResetLinkResponse(string Token, DateTimeOffset ExpiresAt);

/// <summary>
/// The instance admin's endpoints: the instance's users and the new-family invitations. Need a session (fallback policy);
/// the admin check is in Core.
/// </summary>
public static class AdminEndpoints
{
    public static IServiceCollection AddNalaAdmin(this IServiceCollection services) =>
        services.AddScoped<AdminService>();

    public static IEndpointRouteBuilder MapNalaAdmin(this IEndpointRouteBuilder endpoints)
    {
        var users = endpoints.MapGroup("/api/admin/users");
        users.MapGet("", ListAsync);
        users.MapPost("/{id:guid}/reset-link", CreateResetLinkAsync);

        var invitations = endpoints.MapGroup("/api/admin/invitations");
        invitations.MapPost("", CreateInvitationAsync);
        invitations.MapPost("/email", SendInvitationAsync);
        invitations.MapGet("", ListInvitationsAsync);
        invitations.MapPost("/{id:guid}/revoke", RevokeInvitationAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(AdminService admin, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await admin.ListUsersAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken);
        return result is ListUsersResult.Listed listed
            ? Results.Ok(listed.Users.Select(ToResponse))
            : AdminOnly();
    }

    private static async Task<IResult> CreateResetLinkAsync(
        Guid id, PasswordResetService resets, HttpContext context, CancellationToken cancellationToken) =>
        await resets.CreateLinkAsync(AuthEndpoints.CurrentUser(context)!, id, cancellationToken) switch
        {
            CreateResetLinkResult.Created created => Results.Ok(new ResetLinkResponse(created.Token, created.ExpiresAt)),
            CreateResetLinkResult.NotFound => UserNotFound(),
            _ => AdminOnly(),
        };

    private static async Task<IResult> CreateInvitationAsync(
        InvitationService invitations, HttpContext context, CancellationToken cancellationToken) =>
        await invitations.CreateNewFamilyAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken) switch
        {
            CreateInvitationResult.Created created =>
                Results.Ok(new CreatedInvitationResponse(created.Invitation.Token, created.Invitation.ExpiresAt)),
            _ => AdminOnly(),
        };

    /// <summary>202 once the email is queued; 403, then 404 when SMTP is off; 400 validation problem.</summary>
    private static async Task<IResult> SendInvitationAsync(
        SendInvitationRequest request,
        InvitationService invitations,
        EmailOptions email,
        HttpContext context,
        CancellationToken cancellationToken) =>
        await invitations.SendNewFamilyByEmailAsync(
                AuthEndpoints.CurrentUser(context)!, request.Email, email.Enabled ? email.PublicUrl : null, cancellationToken) switch
        {
            SendInvitationResult.Sent sent => Results.Accepted(value: new SentInvitationResponse(sent.ExpiresAt)),
            SendInvitationResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            SendInvitationResult.Disabled => InvitationEndpoints.EmailInviteDisabled(),
            _ => AdminOnly(),
        };

    private static async Task<IResult> ListInvitationsAsync(
        InvitationService invitations, HttpContext context, CancellationToken cancellationToken) =>
        await invitations.ListPendingNewFamilyAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken) is { } pending
            ? Results.Ok(pending.Select(InvitationEndpoints.ToResponse))
            : AdminOnly();

    /// <summary>204 when revoked (now or before); 410 when used or expired; 404 for an unknown or join invitation.</summary>
    private static async Task<IResult> RevokeInvitationAsync(
        Guid id, InvitationService invitations, HttpContext context, CancellationToken cancellationToken) =>
        await invitations.RevokeNewFamilyAsync(AuthEndpoints.CurrentUser(context)!, id, cancellationToken) switch
        {
            RevokeInvitationResult.Revoked => Results.NoContent(),
            RevokeInvitationResult.Unavailable unavailable => AuthEndpoints.InvitationUnavailable(unavailable.Problem),
            RevokeInvitationResult.AdminOnly => AdminOnly(),
            _ => AuthEndpoints.InvitationUnavailable(InvitationProblem.Unknown),
        };

    internal static IResult UserNotFound() =>
        Results.Json(new ErrorResponse("userNotFound"), statusCode: StatusCodes.Status404NotFound);

    internal static IResult AdminOnly() =>
        Results.Json(new ErrorResponse("adminOnly"), statusCode: StatusCodes.Status403Forbidden);

    private static AdminUserResponse ToResponse(User user) =>
        new(user.Id, user.DisplayName, user.Email!, user.IsAdmin, user.LastActivityAt);
}
