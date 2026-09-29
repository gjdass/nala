namespace Nala.Core.Users;

public static class UserOrder
{
    /// <summary>The admin first, then by display name (case-insensitive).</summary>
    public static IReadOnlyList<User> AdminFirstThenByName(IEnumerable<User> users) =>
        users
            .OrderByDescending(u => u.IsAdmin)
            .ThenBy(u => u.DisplayName, StringComparer.InvariantCultureIgnoreCase)
            .ToList();
}
