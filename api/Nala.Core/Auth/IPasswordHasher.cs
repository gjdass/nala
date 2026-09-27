namespace Nala.Core.Auth;

/// <summary>Salted slow hashing of passwords. Plain passwords never leave the auth services.</summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string hash, string password);
}
