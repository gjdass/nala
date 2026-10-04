using Nala.Core.Entries;

namespace Nala.Core.Diapers;

/// <summary>A diaper with who logged it and who last changed it.</summary>
public sealed record DiaperEntry(Diaper Diaper, UserName LoggedBy, UserName UpdatedBy);
