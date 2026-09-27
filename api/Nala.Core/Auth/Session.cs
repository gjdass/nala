namespace Nala.Core.Auth;

/// <summary>A signed-in device. The auth cookie only carries its id; deleting the row ends the session.</summary>
public class Session
{
    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset LastSeenAt { get; set; }
}
