namespace Nala.Core.Entries;

/// <summary>A user as shown on an entry; deleted accounts keep their display name.</summary>
public sealed record UserName(Guid Id, string DisplayName);
