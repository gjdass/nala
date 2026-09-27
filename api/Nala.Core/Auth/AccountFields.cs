namespace Nala.Core.Auth;

/// <summary>Validation of the fields that create an account (setup, invitation registration).</summary>
public static class AccountFields
{
    /// <summary>Field name → error code (<c>required</c>, <c>invalid</c>, <c>tooShort</c>, <c>tooLong</c>); empty when valid.</summary>
    public static Dictionary<string, string> Validate(string? email, string? displayName, string? password)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(email))
        {
            errors["email"] = "required";
        }
        else if (!EmailAddress.TryNormalize(email, out _))
        {
            errors["email"] = "invalid";
        }

        if (string.IsNullOrWhiteSpace(displayName))
        {
            errors["displayName"] = "required";
        }
        else if (!DisplayName.TryNormalize(displayName, out _))
        {
            errors["displayName"] = "tooLong";
        }

        if (string.IsNullOrEmpty(password))
        {
            errors["password"] = "required";
        }
        else if (!PasswordPolicy.IsValid(password))
        {
            errors["password"] = "tooShort";
        }

        return errors;
    }
}
