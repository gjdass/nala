namespace Nala.Core.Babies;

/// <summary>A baby of the family. Birth measurements live here; Growth (09) shows them as its first point.</summary>
public class Baby
{
    public Guid Id { get; init; }

    public required string Name { get; set; }

    /// <summary>A calendar date, no time or time zone.</summary>
    public DateOnly BirthDate { get; set; }

    public Sex Sex { get; set; }

    public int? BirthWeightG { get; set; }

    /// <summary>One decimal at most.</summary>
    public decimal? BirthLengthCm { get; set; }

    /// <summary>One decimal at most.</summary>
    public decimal? BirthHeadCircumferenceCm { get; set; }

    public Guid CreatedByUserId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }
}
