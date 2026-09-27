using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Auth;

namespace Nala.Sql.Auth;

public class LoginFailureConfiguration : IEntityTypeConfiguration<LoginFailure>
{
    public void Configure(EntityTypeBuilder<LoginFailure> failure)
    {
        failure.ToTable("login_failures");
        failure.HasKey(f => f.Id);
        failure.Property(f => f.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        failure.Property(f => f.Email).HasColumnName("email").HasMaxLength(EmailAddress.MaxLength);
        failure.Property(f => f.FailedAt).HasColumnName("failed_at");
        failure.HasIndex(f => new { f.Email, f.FailedAt }).HasDatabaseName("ix_login_failures_email_failed_at");
    }
}
