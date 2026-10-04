using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <inheritdoc />
    public partial class AddGrowthEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "growth_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    baby_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    weight_g = table.Column<int>(type: "integer", nullable: true),
                    length_cm = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    head_circumference_cm = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    logged_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_growth_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_growth_entries_babies_baby_id",
                        column: x => x.baby_id,
                        principalTable: "babies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_growth_entries_users_logged_by_user_id",
                        column: x => x.logged_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_growth_entries_users_updated_by_user_id",
                        column: x => x.updated_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_growth_entries_baby_id_date_created_at_id",
                table: "growth_entries",
                columns: new[] { "baby_id", "date", "created_at", "id" },
                descending: new[] { false, true, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_growth_entries_logged_by_user_id",
                table: "growth_entries",
                column: "logged_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_growth_entries_updated_by_user_id",
                table: "growth_entries",
                column: "updated_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "growth_entries");
        }
    }
}
