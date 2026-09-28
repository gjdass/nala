using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Babies;
using Nala.Core.Users;

namespace Nala.Sql.Babies;

public class BabyConfiguration : IEntityTypeConfiguration<Baby>
{
    public void Configure(EntityTypeBuilder<Baby> baby)
    {
        baby.ToTable("babies");
        baby.HasKey(b => b.Id);
        baby.Property(b => b.Id).HasColumnName("id").ValueGeneratedNever();
        baby.Property(b => b.Name).HasColumnName("name").HasMaxLength(BabyFields.NameMaxLength);
        baby.Property(b => b.BirthDate).HasColumnName("birth_date");
        baby.Property(b => b.Sex).HasColumnName("sex").HasMaxLength(16)
            .HasConversion(s => BabyFields.Format(s), s => BabyFields.ParseSex(s));
        baby.Property(b => b.BirthWeightG).HasColumnName("birth_weight_g");
        baby.Property(b => b.BirthLengthCm).HasColumnName("birth_length_cm").HasPrecision(4, 1);
        baby.Property(b => b.BirthHeadCircumferenceCm).HasColumnName("birth_head_circumference_cm").HasPrecision(4, 1);
        baby.Property(b => b.CreatedByUserId).HasColumnName("created_by_user_id");
        baby.Property(b => b.CreatedAt).HasColumnName("created_at");
        baby.Property(b => b.UpdatedAt).HasColumnName("updated_at");

        // Users are only soft-deleted, so who added a baby is always known.
        baby.HasOne<User>().WithMany().HasForeignKey(b => b.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        baby.HasIndex(b => b.BirthDate).HasDatabaseName("ix_babies_birth_date");
    }
}
