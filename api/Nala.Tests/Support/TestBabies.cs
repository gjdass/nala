using System.Net.Http.Json;
using System.Text.Json;

namespace Nala.Tests.Support;

/// <summary>Adds babies through the API, for tests of other sections.</summary>
public static class TestBabies
{
    /// <summary>Posts <paramref name="body"/> to <c>/api/babies</c> in the caller's first family.</summary>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient client, object body)
    {
        var families = await client.GetFromJsonAsync<JsonElement[]>("/api/families");
        var json = JsonSerializer.SerializeToNode(body)!.AsObject();
        json["familyId"] = families![0].GetProperty("id").GetGuid();
        return await client.PostAsJsonAsync("/api/babies", json);
    }
}
