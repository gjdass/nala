using System.Xml.Linq;

namespace Nala.Tests;

/// <summary>Guards the project dependency rules from api/CLAUDE.md.</summary>
public class ArchitectureTests
{
    private static readonly string[] Infrastructure = ["Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore", "Npgsql"];

    private static XDocument Project(string name)
    {
        var dir = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Nala.slnx")))
        {
            dir = dir.Parent;
        }

        Assert.That(dir, Is.Not.Null, "Nala.slnx not found above the test directory.");
        return XDocument.Load(Path.Combine(dir!.FullName, name, $"{name}.csproj"));
    }

    private static string[] ProjectReferences(string name) =>
        Project(name).Descendants("ProjectReference")
            .Select(e => Path.GetFileNameWithoutExtension(e.Attribute("Include")!.Value.Replace('\\', '/')))
            .ToArray();

    private static string[] PackageReferences(string name) =>
        Project(name).Descendants("PackageReference").Select(e => e.Attribute("Include")!.Value).ToArray();

    [Test]
    public void Core_references_no_other_project_or_infrastructure()
    {
        var core = Project("Nala.Core");

        Assert.That(ProjectReferences("Nala.Core"), Is.Empty);
        Assert.That(PackageReferences("Nala.Core").Where(p => Infrastructure.Any(p.StartsWith)), Is.Empty);
        Assert.That(core.Root!.Attribute("Sdk")!.Value, Is.EqualTo("Microsoft.NET.Sdk"));
        Assert.That(core.Descendants("FrameworkReference"), Is.Empty);
    }

    [Test]
    public void Sql_references_Core_but_not_Api()
    {
        Assert.That(ProjectReferences("Nala.Sql"), Is.EquivalentTo(new[] { "Nala.Core" }));
    }

    [Test]
    public void Api_references_Core_and_Sql()
    {
        Assert.That(ProjectReferences("Nala.Api"), Is.EquivalentTo(new[] { "Nala.Core", "Nala.Sql" }));
    }
}
