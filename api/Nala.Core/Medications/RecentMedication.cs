namespace Nala.Core.Medications;

/// <summary>A recently given medicine name with the dose of its latest entry (spec 09); no dose when that entry had none.</summary>
public sealed record RecentMedication(string Name, decimal? Amount, MedicationUnit? Unit);
