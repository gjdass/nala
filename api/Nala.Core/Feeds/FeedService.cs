using Nala.Core.Entries;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Feeds;

public abstract record CreateFeedResult
{
    public sealed record Created(FeedEntry Entry) : CreateFeedResult;

    /// <summary>A feed with this id exists already (a re-sent request): it is returned unchanged.</summary>
    public sealed record AlreadyExists(FeedEntry Entry) : CreateFeedResult;

    /// <summary>The id belongs to a feed of a baby outside the caller's families: it is left unchanged.</summary>
    public sealed record NotFound : CreateFeedResult;

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
    /// <summary>Starting a side created the live breastfeed.</summary>
    public sealed record Created(FeedEntry Entry) : BreastfeedResult;

    /// <summary>The feed after the action, also when it changed nothing (a re-sent action).</summary>
    public sealed record Updated(FeedEntry Entry) : BreastfeedResult;

    /// <summary>Unknown feed, not a breastfeed, or a feed of a baby outside the caller's families (left unchanged).</summary>
    public sealed record NotFound : BreastfeedResult;

    public sealed record BabyNotFound : BreastfeedResult;

    /// <summary>Another breastfeed of the baby is live.</summary>
    public sealed record InProgressExists : BreastfeedResult;

    /// <summary>Field name → error code.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : BreastfeedResult;
}

public abstract record BreastfeedStateResult
{
    public sealed record Found(BreastfeedState State) : BreastfeedStateResult;

    public sealed record BabyNotFound : BreastfeedStateResult;
}

/// <summary>A baby's feeds (spec 05). Any member of the baby's family can add, edit and delete any feed; outside the caller's families, babies and entries answer as unknown (<see cref="FamilyAccess"/>).</summary>
public class FeedService(IFeedRepository feeds, FamilyAccess access, TimeProvider time)
{
    public const int DefaultPageSize = EntryPaging.DefaultPageSize;

    public const int MaxPageSize = EntryPaging.MaxPageSize;

    /// <summary>
    /// Adds a feed under the client's id. Re-sending an id that exists already (e.g. a queued request sent twice)
    /// returns the stored feed unchanged, whatever the body.
    /// </summary>
    public async Task<CreateFeedResult> CreateAsync(User actor, Guid id, Guid babyId, FeedInput input, CancellationToken cancellationToken = default)
    {
        if (await feeds.GetEntryAsync(id, cancellationToken) is { } existing)
        {
            return await access.ReachesBabyAsync(actor, existing.Feed.BabyId, cancellationToken)
                ? new CreateFeedResult.AlreadyExists(existing)
                : new CreateFeedResult.NotFound();
        }

        var now = time.GetUtcNow();
        var errors = FeedFields.Validate(input);
        if (input.Kind == "breastfeed" && input.Durations is null)
        {
            // Otherwise a breastfeed starts from its timers.
            errors["durations"] = "required";
        }

        if (errors.Count > 0)
        {
            return new CreateFeedResult.Invalid(errors);
        }

        if (!await access.ReachesBabyAsync(actor, babyId, cancellationToken))
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
    /// Replaces every field of the feed's kind; the baby and the kind never change. A breastfeed without typed durations
    /// keeps its sides as they are, live or not; typed durations replace its segments, and a live one keeps its side running.
    /// </summary>
    public async Task<UpdateFeedResult> UpdateAsync(User actor, Guid id, FeedInput input, CancellationToken cancellationToken = default)
    {
        var feed = await feeds.GetAsync(id, cancellationToken);
        if (feed is null || !await access.ReachesBabyAsync(actor, feed.BabyId, cancellationToken))
        {
            return new UpdateFeedResult.NotFound();
        }

        var now = time.GetUtcNow();
        input = input with { Kind = FeedFields.Format(feed.Kind) };
        var errors = FeedFields.Validate(input);
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

    /// <summary>The feed with who logged and last edited it; null when unknown or outside the caller's families.</summary>
    public async Task<FeedEntry?> GetAsync(User user, Guid id, CancellationToken cancellationToken = default) =>
        await feeds.GetEntryAsync(id, cancellationToken) is { } entry && await access.ReachesBabyAsync(user, entry.Feed.BabyId, cancellationToken)
            ? entry
            : null;

    public async Task<DeleteFeedResult> DeleteAsync(User actor, Guid id, CancellationToken cancellationToken = default)
    {
        var feed = await feeds.GetAsync(id, cancellationToken);
        if (feed is null || !await access.ReachesBabyAsync(actor, feed.BabyId, cancellationToken))
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
    public async Task<ListFeedsResult> ListAsync(User user, Guid babyId, string? cursor, int? limit, CancellationToken cancellationToken = default)
    {
        EntryCursor? after = null;
        if (cursor is not null && (after = EntryCursor.TryDecode(cursor)) is null)
        {
            return new ListFeedsResult.InvalidCursor();
        }

        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new ListFeedsResult.BabyNotFound();
        }

        var size = EntryPaging.Size(limit);

        // One more than asked tells whether another page follows.
        var (page, next) = EntryPaging.Split(
            await feeds.ListAsync(babyId, after, size + 1, cancellationToken), size, e => new EntryCursor(e.Feed.StartTime, e.Feed.Id));
        return new ListFeedsResult.Page(page, next);
    }

    public async Task<BottleDefaultsResult> GetBottleDefaultsAsync(User user, Guid babyId, CancellationToken cancellationToken = default) =>
        !await access.ReachesBabyAsync(user, babyId, cancellationToken)
            ? new BottleDefaultsResult.BabyNotFound()
            : new BottleDefaultsResult.Found(await feeds.GetBottleDefaultsAsync(babyId, cancellationToken));

    /// <summary>
    /// Starts a side of the breastfeed <paramref name="feedId"/> at <paramref name="at"/>, stopping the other one. An unknown
    /// feed is created live (start time = <paramref name="at"/>); a stopped one becomes live again. Both are refused while
    /// another breastfeed of the baby is live, unless the start was <paramref name="queued"/> offline: it is then kept
    /// as a separate feed, so nothing logged offline is lost. Re-sending the same <paramref name="segmentId"/> changes nothing.
    /// </summary>
    public async Task<BreastfeedResult> StartSideAsync(
        User actor,
        Guid feedId,
        Guid babyId,
        Guid segmentId,
        string? side,
        DateTimeOffset? at,
        bool queued = false,
        CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var errors = FeedFields.ValidateTimerAction(side, needsSide: true, at);
        if (errors.Count > 0)
        {
            return new BreastfeedResult.Invalid(errors);
        }

        var feed = await feeds.GetAsync(feedId, cancellationToken);
        if (feed is not null
            && (feed.Kind != FeedKind.Breastfeed || !await access.ReachesBabyAsync(actor, feed.BabyId, cancellationToken)))
        {
            return new BreastfeedResult.NotFound();
        }

        if (feed is null && !await access.ReachesBabyAsync(actor, babyId, cancellationToken))
        {
            return new BreastfeedResult.BabyNotFound();
        }

        var startSide = FeedFields.ParseSide(side!);
        var startAt = at!.Value;
        if (feed is not null && (feed.Segments.Any(s => s.Id == segmentId) || Breastfeed.RunningSide(feed) == startSide))
        {
            return await UpdatedAsync(feed, cancellationToken);
        }

        // Making a feed live: at most one live per baby, except for a start queued offline.
        if (!queued
            && (feed is null || feed.EndTime is not null)
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

    /// <summary>
    /// Stops the running side at <paramref name="at"/>, which becomes the feed's end time: it is no longer live, an ordinary
    /// feed (spec 04 Timers). Nothing running changes nothing.
    /// </summary>
    public async Task<BreastfeedResult> StopSideAsync(User actor, Guid feedId, DateTimeOffset? at, CancellationToken cancellationToken = default)
    {
        var errors = FeedFields.ValidateTimerAction(null, needsSide: false, at);
        if (errors.Count > 0)
        {
            return new BreastfeedResult.Invalid(errors);
        }

        if (await GetBreastfeedAsync(feedId, cancellationToken) is not { } feed
            || !await access.ReachesBabyAsync(actor, feed.BabyId, cancellationToken))
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
        feed.EndTime = at;
        Touch(feed, actor, time.GetUtcNow());
        await feeds.UpdateAsync(feed, cancellationToken);
        return await UpdatedAsync(feed, cancellationToken);
    }

    public async Task<BreastfeedStateResult> GetBreastfeedStateAsync(User user, Guid babyId, CancellationToken cancellationToken = default)
    {
        if (!await access.ReachesBabyAsync(user, babyId, cancellationToken))
        {
            return new BreastfeedStateResult.BabyNotFound();
        }

        return new BreastfeedStateResult.Found(new BreastfeedState(
            await feeds.GetInProgressBreastfeedAsync(babyId, cancellationToken),
            await feeds.GetLastBreastSideAsync(babyId, cancellationToken)));
    }

    /// <summary>The live breastfeeds of the babies of the caller's families, oldest start first.</summary>
    public async Task<IReadOnlyList<FeedEntry>> ListInProgressBreastfeedsAsync(User user, CancellationToken cancellationToken = default) =>
        await feeds.ListInProgressBreastfeedsAsync(await access.BabyIdsAsync(user, cancellationToken), cancellationToken);

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
        feed.Notes = EntryFields.NormalizeText(input.Notes);
        if (feed.Kind == FeedKind.Breastfeed && input.Durations is { } durations)
        {
            var left = TimeSpan.FromSeconds(durations.LeftSeconds!.Value);
            var right = TimeSpan.FromSeconds(durations.RightSeconds!.Value);
            var running = Breastfeed.RunningSide(feed);
            feed.Segments.Clear();
            if (running is { } side)
            {
                feed.Segments.AddRange(Breastfeed.LiveSyntheticSegments(feed.Id, feed.StartTime, side == BreastSide.Left ? right : left, side));
            }
            else
            {
                feed.Segments.AddRange(Breastfeed.SyntheticSegments(feed.Id, feed.StartTime, left, right, FeedFields.EndedOn(durations)));
                feed.EndTime = feed.StartTime + left + right;
            }
        }
        else if (feed.Kind == FeedKind.Bottle)
        {
            feed.MilkType = FeedFields.ParseMilkType(input.MilkType!);
            feed.AmountMl = (int)input.AmountMl!.Value;
        }
        else if (feed.Kind == FeedKind.Solids)
        {
            feed.MealType = FeedFields.ParseMealType(input.MealType);
            feed.Food = EntryFields.NormalizeText(input.Food);
            feed.Reaction = FeedFields.ParseReaction(input.Reaction);
        }

        Touch(feed, actor, now);
    }
}
