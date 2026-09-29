using Nala.Api.Auth;
using Nala.Core.Babies;

namespace Nala.Api.Babies;

/// <summary>Measurements are decimals so a fractional weight gets a validation code rather than a binding error.</summary>
public sealed record BabyRequest(
    string? Name,
    DateOnly? BirthDate,
    string? Sex,
    decimal? BirthWeightG,
    decimal? BirthLengthCm,
    decimal? BirthHeadCircumferenceCm);

/// <summary><c>BirthDate</c> is <c>yyyy-MM-dd</c>; <c>Sex</c> is <c>girl</c>, <c>boy</c> or <c>unspecified</c>.</summary>
public sealed record BabyResponse(
    Guid Id,
    string Name,
    DateOnly BirthDate,
    string Sex,
    int? BirthWeightG,
    decimal? BirthLengthCm,
    decimal? BirthHeadCircumferenceCm);

/// <summary>The family's babies. Every member may use them (fallback session policy); there is no per-baby access.</summary>
public static class BabyEndpoints
{
    public static IServiceCollection AddNalaBabies(this IServiceCollection services) =>
        services.AddScoped<BabyService>();

    public static IEndpointRouteBuilder MapNalaBabies(this IEndpointRouteBuilder endpoints)
    {
        var babies = endpoints.MapGroup("/api/babies");
        babies.MapGet("", ListAsync);
        babies.MapPost("", CreateAsync);
        babies.MapPut("/{id:guid}", UpdateAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(BabyService babies, CancellationToken cancellationToken) =>
        Results.Ok((await babies.ListAsync(cancellationToken)).Select(ToResponse));

    private static async Task<IResult> CreateAsync(
        BabyRequest request, BabyService babies, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await babies.CreateAsync(AuthEndpoints.CurrentUser(context)!, ToInput(request), cancellationToken);
        return result is CreateBabyResult.Created created
            ? Results.Created($"/api/babies/{created.Baby.Id}", ToResponse(created.Baby))
            : AuthEndpoints.ValidationProblem(((CreateBabyResult.Invalid)result).Errors);
    }

    private static async Task<IResult> UpdateAsync(
        Guid id, BabyRequest request, BabyService babies, HttpContext context, CancellationToken cancellationToken) =>
        await babies.UpdateAsync(AuthEndpoints.CurrentUser(context)!, id, ToInput(request), cancellationToken) switch
        {
            UpdateBabyResult.Updated updated => Results.Ok(ToResponse(updated.Baby)),
            UpdateBabyResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            _ => Results.Json(new ErrorResponse("babyNotFound"), statusCode: StatusCodes.Status404NotFound),
        };

    private static BabyInput ToInput(BabyRequest request) =>
        new(request.Name, request.BirthDate, request.Sex, request.BirthWeightG, request.BirthLengthCm, request.BirthHeadCircumferenceCm);

    private static BabyResponse ToResponse(Baby baby) =>
        new(baby.Id, baby.Name, baby.BirthDate, BabyFields.Format(baby.Sex), baby.BirthWeightG, baby.BirthLengthCm, baby.BirthHeadCircumferenceCm);
}
