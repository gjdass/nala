using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <inheritdoc />
    public partial class AddBabies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "babies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: false),
                    sex = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    birth_weight_g = table.Column<int>(type: "integer", nullable: true),
                    birth_length_cm = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    birth_head_circumference_cm = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_babies", x => x.id);
                    table.ForeignKey(
                        name: "FK_babies_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_babies_birth_date",
                table: "babies",
                column: "birth_date");

            migrationBuilder.CreateIndex(
                name: "IX_babies_created_by_user_id",
                table: "babies",
                column: "created_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "babies");
        }
    }
}
