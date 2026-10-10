namespace Nala.Core.Families;

/// <summary>A family as one of its members sees it: with their role in it.</summary>
public sealed record UserFamily(Family Family, FamilyRole Role);
