namespace Nala.Core.Families;

/// <summary>A user's place in a family: one per family and user.</summary>
public class Membership
{
    public Guid FamilyId { get; init; }

    public Guid UserId { get; init; }

    public FamilyRole Role { get; init; }

    public DateTimeOffset JoinedAt { get; init; }
}
