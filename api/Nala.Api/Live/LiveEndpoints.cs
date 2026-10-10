using Nala.Api.Auth;
using Nala.Api.Feeds;
using Nala.Api.Pumps;
using Nala.Api.Sleeps;
using Nala.Core.Feeds;
using Nala.Core.Pumps;
using Nala.Core.Sleeps;

namespace Nala.Api.Live;

/// <summary>The live entries of the babies of the caller's families, per section with timers, oldest start first.</summary>
public sealed record LiveResponse(IEnumerable<FeedResponse> Feeds, IEnumerable<SleepResponse> Sleeps, IEnumerable<PumpResponse> Pumps);

/// <summary>What devices poll to see other devices' timers: one call for every section (spec 04 Live sync).</summary>
public static class LiveEndpoints
{
    public static IEndpointRouteBuilder MapNalaLive(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/live", LiveAsync);
        return endpoints;
    }

    private static async Task<IResult> LiveAsync(
        FeedService feeds, SleepService sleeps, PumpService pumps, HttpContext context, CancellationToken cancellationToken)
    {
        var user = AuthEndpoints.CurrentUser(context)!;
        return Results.Ok(new LiveResponse(
            (await feeds.ListInProgressBreastfeedsAsync(user, cancellationToken)).Select(FeedEndpoints.ToResponse),
            (await sleeps.ListLiveAsync(user, cancellationToken)).Select(SleepEndpoints.ToResponse),
            (await pumps.ListLiveAsync(user, cancellationToken)).Select(PumpEndpoints.ToResponse)));
    }
}
