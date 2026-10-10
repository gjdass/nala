using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Sql.Families;

public class FamilyConfiguration : IEntityTypeConfiguration<Family>
{
    public void Configure(EntityTypeBuilder<Family> family)
    {
        family.ToTable("families");
        family.HasKey(f => f.Id);
        family.Property(f => f.Id).HasColumnName("id").ValueGeneratedNever();
        family.Property(f => f.Name).HasColumnName("name").HasMaxLength(FamilyName.MaxLength);
        family.Property(f => f.CreatedByUserId).HasColumnName("created_by_user_id");
        family.Property(f => f.CreatedAt).HasColumnName("created_at");

        // Users are only soft-deleted, so who created a family is always known.
        family.HasOne<User>().WithMany().HasForeignKey(f => f.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
