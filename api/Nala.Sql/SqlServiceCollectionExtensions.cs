using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nala.Core.Auth;
using Nala.Core.Babies;
using Nala.Core.Feeds;
using Nala.Core.Invitations;
using Nala.Core.Sections;
using Nala.Core.Users;
using Nala.Sql.Auth;
using Nala.Sql.Babies;
using Nala.Sql.Feeds;
using Nala.Sql.Invitations;
using Nala.Sql.Sections;
using Nala.Sql.Users;

namespace Nala.Sql;

public static class SqlServiceCollectionExtensions
{
    public static IServiceCollection AddNalaSql(this IServiceCollection services, string connectionString) =>
        services
            .AddDbContext<NalaDbContext>(options => options.UseNpgsql(connectionString))
            .AddScoped<IUserRepository, UserRepository>()
            .AddScoped<ISessionRepository, SessionRepository>()
            .AddScoped<ILoginFailureRepository, LoginFailureRepository>()
            .AddScoped<IInvitationRepository, InvitationRepository>()
            .AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>()
            .AddScoped<IBabyRepository, BabyRepository>()
            .AddScoped<IFeedRepository, FeedRepository>()
            .AddScoped<ISectionPreferenceRepository, SectionPreferenceRepository>();
}
