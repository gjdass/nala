using Nala.Api.Auth;
using Nala.Core.Families;

namespace Nala.Api.Families;

/// <summary><c>IsAdmin</c>: the caller is the family's admin.</summary>
public sealed record FamilyResponse(Guid Id, string Name, bool IsAdmin);

/// <summary>The caller's families (fallback session policy).</summary>
public static class FamilyEndpoints
{
    public static IServiceCollection AddNalaFamilies(this IServiceCollection services) =>
        services.AddScoped<FamilyService>();

    public static IEndpointRouteBuilder MapNalaFamilies(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/families", ListAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(FamilyService families, HttpContext context, CancellationToken cancellationToken) =>
        Results.Ok((await families.ListAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken))
            .Select(f => new FamilyResponse(f.Family.Id, f.Family.Name, f.Role == FamilyRole.Admin)));
}
