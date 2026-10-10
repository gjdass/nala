using Nala.Api.Admin;
using Nala.Api.Auth;
using Nala.Api.Families;
using Nala.Core.Families;
using Nala.Core.Members;

namespace Nala.Api.Members;

/// <summary><c>IsAdmin</c>: the member is the family's admin.</summary>
public sealed record MemberResponse(Guid Id, string DisplayName, string Email, bool IsAdmin);

/// <summary>
/// A family's members. Any member lists them (fallback session policy); only the family admin removes one, checked in
/// Core. A family the caller isn't in is 404 <c>familyNotFound</c>.
/// </summary>
public static class MemberEndpoints
{
    public static IServiceCollection AddNalaMembers(this IServiceCollection services) =>
        services.AddScoped<MemberService>();

    public static IEndpointRouteBuilder MapNalaMembers(this IEndpointRouteBuilder endpoints)
    {
        var members = endpoints.MapGroup("/api/families/{familyId:guid}/members");
        members.MapGet("", ListAsync);
        members.MapPost("/{userId:guid}/remove", RemoveAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(
        Guid familyId, MemberService members, HttpContext context, CancellationToken cancellationToken) =>
        await members.ListAsync(AuthEndpoints.CurrentUser(context)!, familyId, cancellationToken) is ListMembersResult.Listed listed
            ? Results.Ok(listed.Members.Select(ToResponse))
            : FamilyEndpoints.FamilyNotFound();

    private static async Task<IResult> RemoveAsync(
        Guid familyId, Guid userId, MemberService members, HttpContext context, CancellationToken cancellationToken) =>
        await members.RemoveAsync(AuthEndpoints.CurrentUser(context)!, familyId, userId, cancellationToken) switch
        {
            RemoveMemberResult.Removed => Results.NoContent(),
            RemoveMemberResult.Forbidden => FamilyEndpoints.FamilyAdminOnly(),
            RemoveMemberResult.UserNotFound => AdminEndpoints.UserNotFound(),
            RemoveMemberResult.AdminCannotRemove =>
                Results.Json(new ErrorResponse("adminCannotRemove"), statusCode: StatusCodes.Status403Forbidden),
            _ => FamilyEndpoints.FamilyNotFound(),
        };

    private static MemberResponse ToResponse(FamilyMember member) =>
        new(member.User.Id, member.User.DisplayName, member.User.Email!, member.Role == FamilyRole.Admin);
}
