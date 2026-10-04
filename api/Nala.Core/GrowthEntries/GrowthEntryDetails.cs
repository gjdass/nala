using Nala.Core.Entries;

namespace Nala.Core.GrowthEntries;

/// <summary>A growth entry with who logged it and who last changed it.</summary>
public sealed record GrowthEntryDetails(GrowthEntry GrowthEntry, UserName LoggedBy, UserName UpdatedBy);
