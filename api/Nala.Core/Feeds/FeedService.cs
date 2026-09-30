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

    /// <summary>Replaces every field of the feed's kind; the baby and the kind never change.</summary>
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

    /// <summary>Call only on validated input.</summary>
    private static void Apply(Feed feed, FeedInput input, User actor, DateTimeOffset now)
    {
        feed.StartTime = input.StartTime!.Value;
        feed.Notes = FeedFields.NormalizeNotes(input.Notes);
        if (feed.Kind == FeedKind.Bottle)
        {
            feed.MilkType = FeedFields.ParseMilkType(input.MilkType!);
            feed.AmountMl = (int)input.AmountMl!.Value;
        }

        feed.UpdatedByUserId = actor.Id;
        feed.UpdatedAt = now;
    }
}
