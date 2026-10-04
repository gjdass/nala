using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <inheritdoc />
    public partial class AddHealthEntryTemperature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "name",
                table: "health_entries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<decimal>(
                name: "temperature",
                table: "health_entries",
                type: "numeric(3,1)",
                precision: 3,
                scale: 1,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "temperature",
                table: "health_entries");

            migrationBuilder.AlterColumn<string>(
                name: "name",
                table: "health_entries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);
        }
    }
}
