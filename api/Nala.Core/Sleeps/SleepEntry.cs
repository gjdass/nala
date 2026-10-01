using Nala.Core.Entries;

namespace Nala.Core.Sleeps;

/// <summary>A sleep with who logged it and who last changed it.</summary>
public sealed record SleepEntry(Sleep Sleep, UserName LoggedBy, UserName UpdatedBy);
