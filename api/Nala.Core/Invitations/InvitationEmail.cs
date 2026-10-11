using System.Globalization;
using Nala.Core.Email;
using Nala.Core.Users;

namespace Nala.Core.Invitations;

/// <summary>
/// The email carrying an invitation link, in the inviter's language (English when it has no translation): to join
/// <c>familyName</c>, or to create a family when it is null.
/// </summary>
public static class InvitationEmail
{
    public static EmailMessage Compose(User inviter, string? familyName, string to, Uri publicUrl, string token, DateTimeOffset expiresAt)
    {
        var link = $"{publicUrl.AbsoluteUri.TrimEnd('/')}/invite/{token}";
        var utc = expiresAt.UtcDateTime;
        if (inviter.PreferredLanguage == "fr")
        {
            var invite = familyName is null
                ? $"{inviter.DisplayName} vous invite à créer votre famille sur Nala, pour suivre les repas, le sommeil et les couches de bébé. Ouvrez ce lien pour la créer"
                : $"{inviter.DisplayName} vous invite à rejoindre la famille « {familyName} » sur Nala, pour suivre ensemble les repas, le sommeil et les couches de bébé. Ouvrez ce lien pour la rejoindre";
            return new EmailMessage(
                to,
                "Invitation à rejoindre Nala",
                $"""
                Bonjour,

                {invite} ; il ne sert qu'une fois, jusqu'au {utc.ToString("d MMMM yyyy 'à' HH:mm", CultureInfo.GetCultureInfo("fr-FR"))} (UTC) :

                {link}

                Si vous ne connaissez pas {inviter.DisplayName}, ignorez cet email.

                """);
        }
        else
        {
            var invite = familyName is null
                ? $"{inviter.DisplayName} invites you to create your family on Nala, to keep track of the baby's feeds, sleep and diapers. Open this link to create it"
                : $"{inviter.DisplayName} invites you to join the family \"{familyName}\" on Nala, to keep track of the baby's feeds, sleep and diapers together. Open this link to join";
            return new EmailMessage(
                to,
                "You're invited to Nala",
                $"""
                Hello,

                {invite}; it works once, until {utc.ToString("MMMM d, yyyy 'at' HH:mm", CultureInfo.GetCultureInfo("en-US"))} (UTC):

                {link}

                If you don't know {inviter.DisplayName}, ignore this email.

                """);
        }
    }
}
