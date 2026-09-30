namespace Nala.Core.Feeds;

/// <summary>A user as shown on an entry; deleted accounts keep their display name.</summary>
public sealed record UserName(Guid Id, string DisplayName);

/// <summary>A feed with who logged it and who last changed it.</summary>
public sealed record FeedEntry(Feed Feed, UserName LoggedBy, UserName UpdatedBy);

/// <summary>What the Bottle sheet pre-fills: the milk type of the latest bottle and the last amount of each milk type.</summary>
public sealed record BottleDefaults(MilkType? MilkType, int? LastBreastMilkMl, int? LastFormulaMl);
