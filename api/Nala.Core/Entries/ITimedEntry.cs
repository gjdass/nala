namespace Nala.Core.Entries;

/// <summary>
/// An entry with a timer (spec 04 Timers: Sleep, Pump): live while it has no end time. What <see cref="EntryTimer{T, TEntry}"/>
/// needs of it; each section keeps its own entity and table.
/// </summary>
public interface ITimedEntry
{
    Guid Id { get; }

    Guid BabyId { get; }

    DateTimeOffset StartTime { get; }

    /// <summary>Null while the entry is live (its timer runs).</summary>
    DateTimeOffset? EndTime { get; set; }

    DateTimeOffset UpdatedAt { get; set; }

    Guid UpdatedByUserId { get; set; }
}

/// <summary>What a new live entry is created with by a Start tap.</summary>
public sealed record NewTimedEntry(Guid Id, Guid BabyId, DateTimeOffset StartTime, Guid LoggedByUserId, DateTimeOffset CreatedAt);
