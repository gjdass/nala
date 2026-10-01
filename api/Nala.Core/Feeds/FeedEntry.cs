using Nala.Core.Entries;

namespace Nala.Core.Feeds;

/// <summary>A feed with who logged it and who last changed it.</summary>
public sealed record FeedEntry(Feed Feed, UserName LoggedBy, UserName UpdatedBy);

/// <summary>What the Bottle sheet pre-fills: the milk type of the latest bottle and the last amount of each milk type.</summary>
public sealed record BottleDefaults(MilkType? MilkType, int? LastBreastMilkMl, int? LastFormulaMl);

/// <summary>The baby's live breastfeed, if any, and the side the latest breastfeed that isn't live ended on.</summary>
public sealed record BreastfeedState(FeedEntry? InProgress, BreastSide? LastSide);
