using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Sql.Auth;

public class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> session)
    {
        session.ToTable("sessions");
        session.HasKey(s => s.Id);
        session.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
        session.Property(s => s.UserId).HasColumnName("user_id");
        session.Property(s => s.CreatedAt).HasColumnName("created_at");
        session.Property(s => s.LastSeenAt).HasColumnName("last_seen_at");

        // Users are never hard-deleted (deletion only clears their credentials).
        session.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Restrict);
        session.HasIndex(s => s.UserId).HasDatabaseName("ix_sessions_user_id");
    }
}
