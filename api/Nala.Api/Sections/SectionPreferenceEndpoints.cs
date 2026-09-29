using Nala.Api.Auth;
using Nala.Core.Sections;

namespace Nala.Api.Sections;

/// <summary>A missing key or visibility is refused as <c>invalid</c> rather than as a binding error.</summary>
public sealed record SectionPreferenceRequest(string? Key, bool? Visible);

public sealed record SectionPreferenceResponse(string Key, bool Visible);

/// <summary>The signed-in user's order and visibility of the home sections (fallback session policy).</summary>
public static class SectionPreferenceEndpoints
{
    public static IServiceCollection AddNalaSectionPreferences(this IServiceCollection services) =>
        services.AddScoped<SectionPreferenceService>();

    public static IEndpointRouteBuilder MapNalaSectionPreferences(this IEndpointRouteBuilder endpoints)
    {
        var sections = endpoints.MapGroup("/api/account/sections");
        sections.MapGet("", GetAsync);
        sections.MapPut("", SaveAsync);
        return endpoints;
    }

    private static async Task<IResult> GetAsync(
        SectionPreferenceService preferences, HttpContext context, CancellationToken cancellationToken) =>
        Results.Ok((await preferences.GetAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken)).Select(ToResponse));

    private static async Task<IResult> SaveAsync(
        SectionPreferenceRequest?[]? request,
        SectionPreferenceService preferences,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var sections = request?.Any(s => s?.Key is null || s.Visible is null) == false
            ? request.Select(s => new SectionSetting(s!.Key!, s.Visible!.Value)).ToList()
            : null;
        return await preferences.SaveAsync(AuthEndpoints.CurrentUser(context)!, sections, cancellationToken) switch
        {
            SaveSectionsResult.Saved saved => Results.Ok(saved.Sections.Select(ToResponse)),
            var invalid => AuthEndpoints.ValidationProblem(((SaveSectionsResult.Invalid)invalid).Errors),
        };
    }

    private static SectionPreferenceResponse ToResponse(SectionSetting section) => new(section.Key, section.Visible);
}
