namespace Nala.Core.Families;

/// <summary>A household on the instance. Its babies, memberships and invitations are deleted with it.</summary>
public class Family
{
    public Guid Id { get; init; }

    public required string Name { get; set; }

    public Guid CreatedByUserId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
