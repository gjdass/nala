using Nala.Api.Auth;
using Nala.Core.Families;

namespace Nala.Api.Families;

/// <summary><c>IsAdmin</c>: the caller is the family's admin.</summary>
public sealed record FamilyResponse(Guid Id, string Name, bool IsAdmin);

public sealed record RenameFamilyRequest(string? Name);

/// <summary>The caller's families (fallback session policy); renaming is for the family admin only.</summary>
public static class FamilyEndpoints
{
    public static IServiceCollection AddNalaFamilies(this IServiceCollection services) =>
        services.AddScoped<FamilyService>().AddScoped<FamilyAccess>();

    public static IEndpointRouteBuilder MapNalaFamilies(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/families", ListAsync);
        endpoints.MapPatch("/api/families/{id:guid}", RenameAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(FamilyService families, HttpContext context, CancellationToken cancellationToken) =>
        Results.Ok((await families.ListAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken))
            .Select(ToResponse));

    private static async Task<IResult> RenameAsync(
        Guid id, RenameFamilyRequest request, FamilyService families, HttpContext context, CancellationToken cancellationToken) =>
        await families.RenameAsync(AuthEndpoints.CurrentUser(context)!, id, request.Name, cancellationToken) switch
        {
            RenameFamilyResult.Renamed renamed => Results.Ok(ToResponse(renamed.Family)),
            RenameFamilyResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            RenameFamilyResult.Forbidden => FamilyAdminOnly(),
            _ => FamilyNotFound(),
        };

    /// <summary>A family the caller isn't in answers like an unknown one.</summary>
    internal static IResult FamilyNotFound() =>
        Results.Json(new ErrorResponse("familyNotFound"), statusCode: StatusCodes.Status404NotFound);

    internal static IResult FamilyAdminOnly() =>
        Results.Json(new ErrorResponse("familyAdminOnly"), statusCode: StatusCodes.Status403Forbidden);

    private static FamilyResponse ToResponse(UserFamily family) =>
        new(family.Family.Id, family.Family.Name, family.Role == FamilyRole.Admin);
}
