namespace Nala.Core.Users;

/// <summary>A user could not be saved because it breaks a uniqueness rule (email among non-deleted users, single admin).</summary>
public class UserConflictException(Exception? innerException = null)
    : Exception("The user conflicts with an existing one.", innerException);
