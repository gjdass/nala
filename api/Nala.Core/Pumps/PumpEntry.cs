using Nala.Core.Entries;

namespace Nala.Core.Pumps;

/// <summary>A pumping session with who logged it and who last changed it.</summary>
public sealed record PumpEntry(Pump Pump, UserName LoggedBy, UserName UpdatedBy);
