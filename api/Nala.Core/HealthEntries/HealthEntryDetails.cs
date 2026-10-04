using Nala.Core.Entries;

namespace Nala.Core.HealthEntries;

/// <summary>A health entry with who logged it and who last changed it.</summary>
public sealed record HealthEntryDetails(HealthEntry HealthEntry, UserName LoggedBy, UserName UpdatedBy);
