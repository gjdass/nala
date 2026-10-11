using Nala.Api.Auth;
using Nala.Core.GrowthEntries;
using Nala.Core.Trends;

namespace Nala.Api.Trends;

/// <summary>A data day of Sleep trends; <c>LongestSeconds</c> is null when no sleep starts that day.</summary>
public sealed record SleepTrendDayResponse(DateOnly Date, long DaySeconds, long NightSeconds, long? LongestSeconds);

/// <summary>A data day of Diaper trends: a wet and dirty diaper counts in both, <c>Count</c> includes dry ones.</summary>
public sealed record DiaperTrendDayResponse(DateOnly Date, int Wet, int Dirty, int Count);

/// <summary>A data day of Pump trends, on the day each session starts.</summary>
public sealed record PumpTrendDayResponse(DateOnly Date, int LeftMl, int RightMl, int Sessions);

/// <summary>A data day of Feed trends: counts and bottle ml on each feed's start day, breast seconds per side split across days.</summary>
public sealed record FeedTrendDayResponse(
    DateOnly Date, FeedKindCountsResponse Count, BottleMlResponse BottleMl, BreastSecondsResponse BreastSeconds, long GapSecondsSum, int GapCount);

public sealed record FeedKindCountsResponse(int Breastfeed, int Bottle, int Solids);

public sealed record BottleMlResponse(int BreastMilk, int Formula);

public sealed record BreastSecondsResponse(long Left, long Right);

/// <summary>A point of the growth curves; <c>Birth</c> for the baby's birth measurements, dated with the birth date.</summary>
public sealed record GrowthTrendPointResponse(DateOnly Date, int? WeightG, decimal? LengthCm, decimal? HeadCircumferenceCm, bool Birth);

/// <summary>A milestone of the weight curve; <c>Title</c> only for a custom one.</summary>
public sealed record GrowthTrendMilestoneResponse(DateOnly Date, string Milestone, string? Title);

/// <summary>The measurements and milestones dated in the range, in date order, the birth point first.</summary>
public sealed record GrowthTrendsResponse(IEnumerable<GrowthTrendPointResponse> Measurements, IEnumerable<GrowthTrendMilestoneResponse> Milestones);

/// <summary>Only the data days of the range, in date order.</summary>
public sealed record TrendsResponse<TDay>(IEnumerable<TDay> Days);

/// <summary>
/// A baby's trends (spec 12), aggregated per local day of <c>tz</c> over the local dates <c>from</c> to <c>to</c>, both
/// included; growth takes calendar dates only, no <c>tz</c>. Every member of the baby's family may read them (fallback
/// session policy, family check in Core).
/// </summary>
public static class TrendEndpoints
{
    public static IServiceCollection AddNalaTrends(this IServiceCollection services) =>
        services.AddScoped<TrendService>();

    public static IEndpointRouteBuilder MapNalaTrends(this IEndpointRouteBuilder endpoints)
    {
        var trends = endpoints.MapGroup("/api/babies/{babyId:guid}/trends");
        trends.MapGet("/sleeps", async (Guid babyId, string? from, string? to, string? tz, TrendService service, HttpContext context, CancellationToken cancellationToken) =>
            Respond(await service.SleepsAsync(AuthEndpoints.CurrentUser(context)!, babyId, from, to, tz, cancellationToken),
                d => new SleepTrendDayResponse(d.Date, d.DaySeconds, d.NightSeconds, d.LongestSeconds)));
        trends.MapGet("/diapers", async (Guid babyId, string? from, string? to, string? tz, TrendService service, HttpContext context, CancellationToken cancellationToken) =>
            Respond(await service.DiapersAsync(AuthEndpoints.CurrentUser(context)!, babyId, from, to, tz, cancellationToken),
                d => new DiaperTrendDayResponse(d.Date, d.Wet, d.Dirty, d.Count)));
        trends.MapGet("/pumps", async (Guid babyId, string? from, string? to, string? tz, TrendService service, HttpContext context, CancellationToken cancellationToken) =>
            Respond(await service.PumpsAsync(AuthEndpoints.CurrentUser(context)!, babyId, from, to, tz, cancellationToken),
                d => new PumpTrendDayResponse(d.Date, d.LeftMl, d.RightMl, d.Sessions)));
        trends.MapGet("/feeds", async (Guid babyId, string? from, string? to, string? tz, TrendService service, HttpContext context, CancellationToken cancellationToken) =>
            Respond(await service.FeedsAsync(AuthEndpoints.CurrentUser(context)!, babyId, from, to, tz, cancellationToken),
                d => new FeedTrendDayResponse(
                    d.Date,
                    new FeedKindCountsResponse(d.Count.Breastfeed, d.Count.Bottle, d.Count.Solids),
                    new BottleMlResponse(d.BottleMl.BreastMilk, d.BottleMl.Formula),
                    new BreastSecondsResponse(d.BreastSeconds.Left, d.BreastSeconds.Right),
                    d.GapSecondsSum,
                    d.GapCount)));
        trends.MapGet("/growth", async (Guid babyId, string? from, string? to, TrendService service, HttpContext context, CancellationToken cancellationToken) =>
            await service.GrowthAsync(AuthEndpoints.CurrentUser(context)!, babyId, from, to, cancellationToken) switch
            {
                GrowthTrendResult.Found found => Results.Ok(new GrowthTrendsResponse(
                    found.Trends.Measurements.Select(m => new GrowthTrendPointResponse(m.Date, m.WeightG, m.LengthCm, m.HeadCircumferenceCm, m.Birth)),
                    found.Trends.Milestones.Select(m => new GrowthTrendMilestoneResponse(m.Date, GrowthEntryFields.FormatMilestone(m.Milestone), m.Title)))),
                GrowthTrendResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
                _ => BabyNotFound(),
            });
        return endpoints;
    }

    private static IResult Respond<TDay, TResponse>(TrendResult<TDay> result, Func<TDay, TResponse> toResponse) => result switch
    {
        TrendResult<TDay>.Days days => Results.Ok(new TrendsResponse<TResponse>(days.Items.Select(toResponse))),
        TrendResult<TDay>.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
        _ => BabyNotFound(),
    };

    private static IResult BabyNotFound() => Results.Json(new ErrorResponse("babyNotFound"), statusCode: StatusCodes.Status404NotFound);
}
