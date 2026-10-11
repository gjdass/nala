using Nala.Api.Auth;
using Nala.Core.Trends;

namespace Nala.Api.Trends;

/// <summary>A data day of Sleep trends; <c>LongestSeconds</c> is null when no sleep starts that day.</summary>
public sealed record SleepTrendDayResponse(DateOnly Date, long DaySeconds, long NightSeconds, long? LongestSeconds);

/// <summary>Only the data days of the range, in date order.</summary>
public sealed record SleepTrendsResponse(IEnumerable<SleepTrendDayResponse> Days);

/// <summary>
/// A baby's trends (spec 12), aggregated per local day of <c>tz</c> over the local dates <c>from</c> to <c>to</c>, both
/// included. Every member of the baby's family may read them (fallback session policy, family check in Core).
/// </summary>
public static class TrendEndpoints
{
    public static IServiceCollection AddNalaTrends(this IServiceCollection services) =>
        services.AddScoped<TrendService>();

    public static IEndpointRouteBuilder MapNalaTrends(this IEndpointRouteBuilder endpoints)
    {
        var trends = endpoints.MapGroup("/api/babies/{babyId:guid}/trends");
        trends.MapGet("/sleeps", SleepsAsync);
        return endpoints;
    }

    private static async Task<IResult> SleepsAsync(
        Guid babyId, string? from, string? to, string? tz, TrendService trends, HttpContext context, CancellationToken cancellationToken) =>
        await trends.SleepsAsync(AuthEndpoints.CurrentUser(context)!, babyId, from, to, tz, cancellationToken) switch
        {
            TrendResult<SleepTrendDay>.Days days => Results.Ok(new SleepTrendsResponse(
                days.Items.Select(d => new SleepTrendDayResponse(d.Date, d.DaySeconds, d.NightSeconds, d.LongestSeconds)))),
            TrendResult<SleepTrendDay>.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            _ => Results.Json(new ErrorResponse("babyNotFound"), statusCode: StatusCodes.Status404NotFound),
        };
}
