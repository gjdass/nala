namespace Nala.Core.Families;

public static class FamilyOrder
{
    /// <summary>By name (case-insensitive), then by creation.</summary>
    public static IReadOnlyList<UserFamily> ByName(IEnumerable<UserFamily> families) =>
        families
            .OrderBy(f => f.Family.Name, StringComparer.InvariantCultureIgnoreCase)
            .ThenBy(f => f.Family.CreatedAt)
            .ToList();
}
