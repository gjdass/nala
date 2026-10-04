using Nala.Api.Feeds;
using Nala.Api.Pumps;
using Nala.Api.Sleeps;
using Nala.Core.Feeds;
using Nala.Core.Pumps;
using Nala.Core.Sleeps;

namespace Nala.Api.Live;

/// <summary>Every baby's live entries, per section with timers, oldest start first.</summary>
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
        FeedService feeds, SleepService sleeps, PumpService pumps, CancellationToken cancellationToken) =>
        Results.Ok(new LiveResponse(
            (await feeds.ListInProgressBreastfeedsAsync(cancellationToken)).Select(FeedEndpoints.ToResponse),
            (await sleeps.ListLiveAsync(cancellationToken)).Select(SleepEndpoints.ToResponse),
            (await pumps.ListLiveAsync(cancellationToken)).Select(PumpEndpoints.ToResponse)));
}
