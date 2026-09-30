using Nala.Core.Babies;
using Nala.Core.Users;

namespace Nala.Core.Feeds;

public abstract record CreateFeedResult
{
    public sealed record Created(FeedEntry Entry) : CreateFeedResult;

    /// <summary>A feed with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(FeedEntry Entry) : CreateFeedResult;

    public sealed record BabyNotFound : CreateFeedResult;

    /// <summary>Field name → error code, see <see cref="FeedFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : CreateFeedResult;
}

public abstract record UpdateFeedResult
{
    public sealed record Updated(FeedEntry Entry) : UpdateFeedResult;

    public sealed record NotFound : UpdateFeedResult;

    /// <summary>Field name → error code, see <see cref="FeedFields.Validate"/>.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateFeedResult;
}

public abstract record DeleteFeedResult
{
    public sealed record Deleted : DeleteFeedResult;

    public sealed record NotFound : DeleteFeedResult;
}

public abstract record ListFeedsResult
{
    /// <summary><paramref name="Next"/> is the cursor of the following page, null after the last one.</summary>
    public sealed record Page(IReadOnlyList<FeedEntry> Entries, string? Next) : ListFeedsResult;

    public sealed record BabyNotFound : ListFeedsResult;

    public sealed record InvalidCursor : ListFeedsResult;
}

public abstract record BottleDefaultsResult
{
    public sealed record Found(BottleDefaults Defaults) : BottleDefaultsResult;

    public sealed record BabyNotFound : BottleDefaultsResult;
}

/// <summary>The outcome of a breastfeed timer action.</summary>
public abstract record BreastfeedResult
{
    /// <summary>Starting a side created the in-progress breastfeed.</summary>
    public sealed record Created(FeedEntry Entry) : BreastfeedResult;

    /// <summary>The feed after the action, also when it changed nothing (a re-sent action).</summary>
    public sealed record Updated(FeedEntry Entry) : BreastfeedResult;

    /// <summary>Unknown feed, or not a breastfeed.</summary>
    public sealed record NotFound : BreastfeedResult;

    public sealed record BabyNotFound : BreastfeedResult;

    /// <summary>Another breastfeed of the baby is in progress.</summary>
    public sealed record InProgressExists : BreastfeedResult;

    /// <summary>Field name → error code.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : BreastfeedResult;
}

public abstract record BreastfeedStateResult
{
    public sealed record Found(BreastfeedState State) : BreastfeedStateResult;

    public sealed record BabyNotFound : BreastfeedStateResult;
}

/// <summary>A baby's feeds (spec 05). Any member can add, edit and delete any feed.</summary>
public class FeedService(IFeedRepository feeds, IBabyRepository babies, TimeProvider time)
{
    public const int DefaultPageSize = 20;

    public const int MaxPageSize = 50;

    /// <summary>
    /// Adds a feed under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored feed unchanged, whatever the body.
    /// </summary>
    public async Task<CreateFeedResult> CreateAsync(User actor, Guid id, Guid babyId, FeedInput input, CancellationToken cancellationToken = default)
    {
        if (await feeds.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return new CreateFeedResult.AlreadyExists(existing);
        }

        var now = time.GetUtcNow();
        var errors = FeedFields.Validate(input, now);
        if (input.Kind == "breastfeed" && input.Durations is null)
        {
            // Otherwise a breastfeed starts from its timers.
            errors["durations"] = "required";
        }

        if (errors.Count > 0)
        {
            return new CreateFeedResult.Invalid(errors);
        }

        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new CreateFeedResult.BabyNotFound();
        }

        var feed = new Feed
        {
            Id = id,
            BabyId = babyId,
            Kind = FeedFields.ParseKind(input.Kind!),
            LoggedByUserId = actor.Id,
            CreatedAt = now,
        };
        Apply(feed, input, actor, now);
        await feeds.AddAsync(feed, cancellationToken);
        return new CreateFeedResult.Created((await feeds.GetEntryAsync(id, cancellationToken))!);
    }

    /// <summary>
    /// Replaces every field of the feed's kind; the baby and the kind never change. On a breastfeed, typed durations
    /// replace its segments and save it (also one in progress).
    /// </summary>
    public async Task<UpdateFeedResult> UpdateAsync(User actor, Guid id, FeedInput input, CancellationToken cancellationToken = default)
    {
        var feed = await feeds.GetAsync(id, cancellationToken);
        if (feed is null)
        {
            return new UpdateFeedResult.NotFound();
        }

        var now = time.GetUtcNow();
        input = input with { Kind = FeedFields.Format(feed.Kind) };
        var errors = FeedFields.Validate(input, now);
        if (!errors.ContainsKey("startTime") && input.Durations is null && feed.EndTime is { } end && input.StartTime > end)
        {
            errors["startTime"] = "afterEnd";
        }

        if (errors.Count > 0)
        {
            return new UpdateFeedResult.Invalid(errors);
        }

        Apply(feed, input, actor, now);
        await feeds.UpdateAsync(feed, cancellationToken);
        return new UpdateFeedResult.Updated((await feeds.GetEntryAsync(id, cancellationToken))!);
    }

    public async Task<DeleteFeedResult> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var feed = await feeds.GetAsync(id, cancellationToken);
        if (feed is null)
        {
            return new DeleteFeedResult.NotFound();
        }

        await feeds.DeleteAsync(feed, cancellationToken);
        return new DeleteFeedResult.Deleted();
    }

    /// <summary>
    /// One page of the baby's feeds, newest first. <paramref name="limit"/> defaults to <see cref="DefaultPageSize"/> and is
    /// kept within 1–<see cref="MaxPageSize"/>.
    /// </summary>
    public async Task<ListFeedsResult> ListAsync(Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        FeedCursor? after = null;
        if (cursor is not null && (after = FeedCursor.TryDecode(cursor)) is null)
        {
            return new ListFeedsResult.InvalidCursor();
        }

        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new ListFeedsResult.BabyNotFound();
        }

        var size = Math.Clamp(limit ?? DefaultPageSize, 1, MaxPageSize);

        // One more than asked tells whether another page follows.
        var entries = await feeds.ListAsync(babyId, after, size + 1, cancellationToken);
        if (entries.Count <= size)
        {
            return new ListFeedsResult.Page(entries, null);
        }

        var page = entries.Take(size).ToList();
        var last = page[^1].Feed;
        return new ListFeedsResult.Page(page, new FeedCursor(last.StartTime, last.Id).Encode());
    }

    public async Task<BottleDefaultsResult> GetBottleDefaultsAsync(Guid babyId, CancellationToken cancellationToken = default) =>
        await babies.GetAsync(babyId, cancellationToken) is null
            ? new BottleDefaultsResult.BabyNotFound()
            : new BottleDefaultsResult.Found(await feeds.GetBottleDefaultsAsync(babyId, cancellationToken));

    /// <summary>
    /// Starts a side of the breastfeed <paramref name="feedId"/> at <paramref name="at"/>, stopping the other one. An unknown
    /// feed is created in progress (start time = <paramref name="at"/>); a saved one is reopened. Both are refused while
    /// another breastfeed of the baby is in progress. Re-sending the same <paramref name="segmentId"/> changes nothing.
    /// </summary>
    public async Task<BreastfeedResult> StartSideAsync(
        User actor, Guid feedId, Guid babyId, Guid segmentId, string? side, DateTimeOffset? at, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = FeedFields.ValidateTimerAction(side, needsSide: true, at, now);
        if (errors.Count > 0)
        {
            return new BreastfeedResult.Invalid(errors);
        }

        var feed = await feeds.GetAsync(feedId, cancellationToken);
        if (feed is not null && feed.Kind != FeedKind.Breastfeed)
        {
            return new BreastfeedResult.NotFound();
        }

        if (feed is null && await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new BreastfeedResult.BabyNotFound();
        }

        var startSide = FeedFields.ParseSide(side!);
        var startAt = at!.Value;
        if (feed is not null && (feed.Segments.Any(s => s.Id == segmentId) || Breastfeed.RunningSide(feed) == startSide))
        {
            return await UpdatedAsync(feed, cancellationToken);
        }

        // Creating or reopening a feed: at most one in progress per baby.
        if ((feed is null || feed.EndTime is not null)
            && await feeds.GetInProgressBreastfeedAsync(feed?.BabyId ?? babyId, cancellationToken) is { } current
            && current.Feed.Id != feedId)
        {
            return new BreastfeedResult.InProgressExists();
        }

        if (feed is not null && startAt < Breastfeed.LatestSegmentTime(feed))
        {
            return new BreastfeedResult.Invalid(new Dictionary<string, string> { ["at"] = "invalid" });
        }

        var created = feed is null;
        feed ??= new Feed
        {
            Id = feedId,
            BabyId = babyId,
            Kind = FeedKind.Breastfeed,
            StartTime = startAt,
            LoggedByUserId = actor.Id,
            CreatedAt = now,
        };
        feed.EndTime = null;
        Breastfeed.OpenSegment(feed)?.EndedAt = startAt;
        feed.Segments.Add(new BreastFeedSegment { Id = segmentId, FeedId = feed.Id, Side = startSide, StartedAt = startAt });
        Touch(feed, actor, now);
        if (created)
        {
            await feeds.AddAsync(feed, cancellationToken);
            return new BreastfeedResult.Created((await feeds.GetEntryAsync(feedId, cancellationToken))!);
        }

        await feeds.UpdateAsync(feed, cancellationToken);
        return await UpdatedAsync(feed, cancellationToken);
    }

    /// <summary>Stops the running side at <paramref name="at"/>; the feed stays in progress. Nothing to stop changes nothing.</summary>
    public async Task<BreastfeedResult> StopSideAsync(User actor, Guid feedId, DateTimeOffset? at, CancellationToken cancellationToken = default)
    {
        var errors = FeedFields.ValidateTimerAction(null, needsSide: false, at, time.GetUtcNow());
        if (errors.Count > 0)
        {
            return new BreastfeedResult.Invalid(errors);
        }

        if (await GetBreastfeedAsync(feedId, cancellationToken) is not { } feed)
        {
            return new BreastfeedResult.NotFound();
        }

        if (Breastfeed.OpenSegment(feed) is not { } open)
        {
            return await UpdatedAsync(feed, cancellationToken);
        }

        if (at < open.StartedAt)
        {
            return new BreastfeedResult.Invalid(new Dictionary<string, string> { ["at"] = "invalid" });
        }

        open.EndedAt = at;
        Touch(feed, actor, time.GetUtcNow());
        await feeds.UpdateAsync(feed, cancellationToken);
        return await UpdatedAsync(feed, cancellationToken);
    }

    /// <summary>
    /// Saves the breastfeed: stops the running side and sets the end time to <paramref name="input"/>'s <c>At</c>, with the
    /// start time and notes from the sheet. Refused when both sides are at 0 s. A saved one is returned unchanged.
    /// </summary>
    public async Task<BreastfeedResult> FinishAsync(User actor, Guid feedId, BreastfeedFinishInput input, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var fields = new FeedInput("breastfeed", input.StartTime, input.Notes, null, null);
        var errors = FeedFields.Validate(fields, now);
        foreach (var (field, code) in FeedFields.ValidateTimerAction(null, needsSide: false, input.At, now))
        {
            errors[field] = code;
        }

        if (errors.Count > 0)
        {
            return new BreastfeedResult.Invalid(errors);
        }

        if (await GetBreastfeedAsync(feedId, cancellationToken) is not { } feed)
        {
            return new BreastfeedResult.NotFound();
        }

        if (feed.EndTime is not null)
        {
            return await UpdatedAsync(feed, cancellationToken);
        }

        var end = input.At!.Value;
        if (end < Breastfeed.LatestSegmentTime(feed))
        {
            return new BreastfeedResult.Invalid(new Dictionary<string, string> { ["at"] = "invalid" });
        }

        if (input.StartTime > end)
        {
            return new BreastfeedResult.Invalid(new Dictionary<string, string> { ["startTime"] = "afterEnd" });
        }

        if (Breastfeed.SideDuration(feed, BreastSide.Left, end) + Breastfeed.SideDuration(feed, BreastSide.Right, end) <= TimeSpan.Zero)
        {
            return new BreastfeedResult.Invalid(new Dictionary<string, string> { ["durations"] = "zero" });
        }

        Breastfeed.OpenSegment(feed)?.EndedAt = end;
        feed.EndTime = end;
        feed.StartTime = input.StartTime!.Value;
        feed.Notes = FeedFields.NormalizeText(input.Notes);
        Touch(feed, actor, now);
        await feeds.UpdateAsync(feed, cancellationToken);
        return await UpdatedAsync(feed, cancellationToken);
    }

    public async Task<BreastfeedStateResult> GetBreastfeedStateAsync(Guid babyId, CancellationToken cancellationToken = default)
    {
        if (await babies.GetAsync(babyId, cancellationToken) is null)
        {
            return new BreastfeedStateResult.BabyNotFound();
        }

        return new BreastfeedStateResult.Found(new BreastfeedState(
            await feeds.GetInProgressBreastfeedAsync(babyId, cancellationToken),
            await feeds.GetLastBreastSideAsync(babyId, cancellationToken)));
    }

    private async Task<Feed?> GetBreastfeedAsync(Guid id, CancellationToken cancellationToken) =>
        await feeds.GetAsync(id, cancellationToken) is { Kind: FeedKind.Breastfeed } feed ? feed : null;

    private async Task<BreastfeedResult> UpdatedAsync(Feed feed, CancellationToken cancellationToken) =>
        new BreastfeedResult.Updated((await feeds.GetEntryAsync(feed.Id, cancellationToken))!);

    private static void Touch(Feed feed, User actor, DateTimeOffset now)
    {
        feed.UpdatedByUserId = actor.Id;
        feed.UpdatedAt = now;
    }

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Feed feed, FeedInput input, User actor, DateTimeOffset now)
    {
        feed.StartTime = input.StartTime!.Value;
        feed.Notes = FeedFields.NormalizeText(input.Notes);
        if (feed.Kind == FeedKind.Breastfeed && input.Durations is { } durations)
        {
            var left = TimeSpan.FromSeconds(durations.LeftSeconds!.Value);
            var right = TimeSpan.FromSeconds(durations.RightSeconds!.Value);
            feed.Segments.Clear();
            feed.Segments.AddRange(Breastfeed.SyntheticSegments(feed.Id, feed.StartTime, left, right, FeedFields.EndedOn(durations)));
            feed.EndTime = feed.StartTime + left + right;
        }
        else if (feed.Kind == FeedKind.Bottle)
        {
            feed.MilkType = FeedFields.ParseMilkType(input.MilkType!);
            feed.AmountMl = (int)input.AmountMl!.Value;
        }
        else if (feed.Kind == FeedKind.Solids)
        {
            feed.MealType = FeedFields.ParseMealType(input.MealType);
            feed.Food = FeedFields.NormalizeText(input.Food);
            feed.Reaction = FeedFields.ParseReaction(input.Reaction);
        }

        Touch(feed, actor, now);
    }
}
