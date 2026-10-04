using Nala.Core.Entries;

namespace Nala.Core.Medications;

/// <summary>A diaper with who logged it and who last changed it.</summary>
public sealed record MedicationEntry(Medication Medication, UserName LoggedBy, UserName UpdatedBy);
