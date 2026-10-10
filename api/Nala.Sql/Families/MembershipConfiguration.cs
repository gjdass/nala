using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Sql.Families;

public class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> membership)
    {
        membership.ToTable("family_memberships");

        // One membership per family and user.
        membership.HasKey(m => new { m.FamilyId, m.UserId });
        membership.Property(m => m.FamilyId).HasColumnName("family_id");
        membership.Property(m => m.UserId).HasColumnName("user_id");
        membership.Property(m => m.Role).HasColumnName("role").HasMaxLength(16)
            .HasConversion(r => r == FamilyRole.Admin ? "admin" : "member", r => r == "admin" ? FamilyRole.Admin : FamilyRole.Member);
        membership.Property(m => m.JoinedAt).HasColumnName("joined_at");

        membership.HasOne<Family>().WithMany().HasForeignKey(m => m.FamilyId).OnDelete(DeleteBehavior.Cascade);

        // Users are only soft-deleted; account deletion deletes the memberships itself.
        membership.HasOne<User>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Restrict);
        membership.HasIndex(m => m.UserId).HasDatabaseName("ix_family_memberships_user_id");

        // A family has exactly one admin.
        membership.HasIndex(m => m.FamilyId).IsUnique().HasFilter("role = 'admin'").HasDatabaseName("ux_family_memberships_single_admin");
    }
}
