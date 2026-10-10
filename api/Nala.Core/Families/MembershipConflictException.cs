namespace Nala.Core.Families;

/// <summary>A membership could not be saved because the user already has one in that family.</summary>
public class MembershipConflictException(Exception? innerException = null)
    : Exception("The user is already a member of that family.", innerException);
