using Microsoft.EntityFrameworkCore;
using Nala.Core.Feeds;
using Nala.Core.Users;

namespace Nala.Sql.Feeds;

public class FeedRepository(NalaDbContext db) : IFeedRepository
{
    public async Task AddAsync(Feed feed, CancellationToken cancellationToken = default)
    {
        db.Set<Feed>().Add(feed);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Feed?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<Feed>().SingleOrDefaultAsync(f => f.Id == id, cancellationToken);

    public Task<FeedEntry?> GetEntryAsync(Guid id, CancellationToken cancellationToken = default) =>
        Entries(db.Set<Feed>().Where(f => f.Id == id)).SingleOrDefaultAsync(cancellationToken);

    public async Task UpdateAsync(Feed feed, CancellationToken cancellationToken = default)
    {
        db.Set<Feed>().Update(feed);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Feed feed, CancellationToken cancellationToken = default)
    {
        db.Set<Feed>().Remove(feed);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FeedEntry>> ListAsync(Guid babyId, FeedCursor? after, int limit, CancellationToken cancellationToken = default)
    {
        var feeds = db.Set<Feed>().Where(f => f.BabyId == babyId);
        if (after is not null)
        {
            // Row comparison, so feeds sharing a start time are paged by id without gaps or repeats.
            feeds = feeds.Where(f => EF.Functions.LessThan(
                ValueTuple.Create(f.StartTime, f.Id), ValueTuple.Create(after.StartTime, after.Id)));
        }

        return await Entries(feeds.OrderByDescending(f => f.StartTime).ThenByDescending(f => f.Id).Take(limit))
            .ToListAsync(cancellationToken);
    }

    public async Task<BottleDefaults> GetBottleDefaultsAsync(Guid babyId, CancellationToken cancellationToken = default)
    {
        var bottles = db.Set<Feed>()
            .AsNoTracking()
            .Where(f => f.BabyId == babyId && f.Kind == FeedKind.Bottle)
            .OrderByDescending(f => f.StartTime);
        var latest = await bottles.Select(f => f.MilkType).FirstOrDefaultAsync(cancellationToken);
        var breastMilk = await bottles.Where(f => f.MilkType == MilkType.BreastMilk).Select(f => f.AmountMl).FirstOrDefaultAsync(cancellationToken);
        var formula = await bottles.Where(f => f.MilkType == MilkType.Formula).Select(f => f.AmountMl).FirstOrDefaultAsync(cancellationToken);
        return new BottleDefaults(latest, breastMilk, formula);
    }

    private IQueryable<FeedEntry> Entries(IQueryable<Feed> feeds) =>
        from feed in feeds.AsNoTracking()
        join loggedBy in db.Set<User>() on feed.LoggedByUserId equals loggedBy.Id
        join updatedBy in db.Set<User>() on feed.UpdatedByUserId equals updatedBy.Id
        select new FeedEntry(feed, new UserName(loggedBy.Id, loggedBy.DisplayName), new UserName(updatedBy.Id, updatedBy.DisplayName));
}
