using Nala.Api.Auth;
using Nala.Core.Admin;
using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Api.Admin;

/// <summary>An account as the instance admin sees it: no family data.</summary>
public sealed record AdminUserResponse(Guid Id, string DisplayName, string Email, bool IsAdmin, DateTimeOffset? LastActivityAt);

/// <summary>The web builds the link <c>/reset/{token}</c> from it.</summary>
public sealed record ResetLinkResponse(string Token, DateTimeOffset ExpiresAt);

/// <summary>The admin's view of the instance's users. Needs a session (fallback policy); the admin check is in Core.</summary>
public static class AdminEndpoints
{
    public static IServiceCollection AddNalaAdmin(this IServiceCollection services) =>
        services.AddScoped<AdminService>();

    public static IEndpointRouteBuilder MapNalaAdmin(this IEndpointRouteBuilder endpoints)
    {
        var users = endpoints.MapGroup("/api/admin/users");
        users.MapGet("", ListAsync);
        users.MapPost("/{id:guid}/reset-link", CreateResetLinkAsync);
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

    internal static IResult UserNotFound() =>
        Results.Json(new ErrorResponse("userNotFound"), statusCode: StatusCodes.Status404NotFound);

    internal static IResult AdminOnly() =>
        Results.Json(new ErrorResponse("adminOnly"), statusCode: StatusCodes.Status403Forbidden);

    private static AdminUserResponse ToResponse(User user) =>
        new(user.Id, user.DisplayName, user.Email!, user.IsAdmin, user.LastActivityAt);
}
