using Nala.Core.Users;

namespace Nala.Core.Families;

/// <summary>A member of a family, with their role in it.</summary>
public sealed record FamilyMember(User User, FamilyRole Role);
