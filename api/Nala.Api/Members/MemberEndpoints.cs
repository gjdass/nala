using Nala.Api.Admin;
using Nala.Api.Auth;
using Nala.Core.Admin;
using Nala.Core.Members;
using Nala.Core.Users;

namespace Nala.Api.Members;

public sealed record MemberResponse(Guid Id, string DisplayName, string Email, bool IsAdmin);

/// <summary>
/// The family's members. Every member may list them (fallback session policy); removing one is the admin disable,
/// refused to anyone but the admin in Core.
/// </summary>
public static class MemberEndpoints
{
    public static IServiceCollection AddNalaMembers(this IServiceCollection services) =>
        services.AddScoped<MemberService>();

    public static IEndpointRouteBuilder MapNalaMembers(this IEndpointRouteBuilder endpoints)
    {
        var members = endpoints.MapGroup("/api/members");
        members.MapGet("", ListAsync);
        members.MapPost("/{id:guid}/remove", RemoveAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(MemberService members, CancellationToken cancellationToken) =>
        Results.Ok((await members.ListAsync(cancellationToken)).Select(ToResponse));

    /// <summary>204 when disabled (now or before).</summary>
    private static async Task<IResult> RemoveAsync(
        Guid id, AdminService admin, HttpContext context, CancellationToken cancellationToken) =>
        await admin.SetDisabledAsync(AuthEndpoints.CurrentUser(context)!, id, disabled: true, cancellationToken) switch
        {
            SetDisabledResult.Updated => Results.NoContent(),
            SetDisabledResult.NotFound => AdminEndpoints.UserNotFound(),
            SetDisabledResult.AdminCannotDisable => AdminEndpoints.AdminCannotDisable(),
            _ => AdminEndpoints.AdminOnly(),
        };

    private static MemberResponse ToResponse(User user) => new(user.Id, user.DisplayName, user.Email!, user.IsAdmin);
}
