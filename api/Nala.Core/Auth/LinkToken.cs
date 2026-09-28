using System.Security.Cryptography;
using System.Text;

namespace Nala.Core.Auth;

/// <summary>The secret in a one-time link (invitation, password reset): 32 random bytes, base64url. Only its hash is stored.</summary>
public static class LinkToken
{
    public static string Generate() => Base64Url(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Base64Url(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
