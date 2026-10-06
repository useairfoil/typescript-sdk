import { ConnectorError, Metrics, Telemetry } from "@useairfoil/connector-kit";
import {
  Clock,
  Config,
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  Option,
  Random,
  Schedule,
  Schema,
} from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { type GitHubConfig, manifest } from "../manifest";
import * as GitHubAuth from "./auth";
import { GITHUB_API_VERSION, baseUrl } from "./constants";

const maxRetries = 5;
const retryBaseDelay = Duration.millis(500);
// GitHub asks to wait at least a minute when a rate limit gives no wait time.
const rateLimitBaseDelay = Duration.minutes(1);
// Covers one attempt. Rate-limit waits are outside it, because the primary
// limit resets on an hourly window.
const requestTimeout = Duration.minutes(2);

export type GitHubPage<A> = {
  readonly body: A;
  readonly next: Option.Option<string>;
};

export type GitHubClientService = {
  /** GETs a path such as `/repos/o/r/issues?state=all`, or a `next` URL. */
  readonly get: <A>(
    schema: Schema.Decoder<A>,
    url: string,
  ) => Effect.Effect<GitHubPage<A>, ConnectorError>;
};

export class GitHubClient extends Context.Service<GitHubClient, GitHubClientService>()(
  "@useairfoil/producer-github/GitHubClient",
) {}

export const withParams = (path: string, params: Readonly<Record<string, string>>): string =>
  `${path}?${new URLSearchParams(params).toString()}`;

export const nextLink = (header: string | undefined): Option.Option<string> =>
  Option.fromNullishOr(/<([^>]+)>;\s*rel="next"/.exec(header ?? "")?.[1]);

const ErrorBodySchema = Schema.Struct({ message: Schema.optional(Schema.String) });

class Retry extends Data.TaggedError("Retry")<{
  readonly reason: Metrics.ApiRetryReason;
  readonly message: string;
  readonly wait: Option.Option<Duration.Duration>;
}> {}

/** GitHub rejected the token. A new one is tried once. */
class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly message: string;
}> {}

const errorMessage = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(ErrorBodySchema)(response).pipe(
    Effect.map((body) => body.message),
    Effect.orElseSucceed(() => undefined),
  );

/**
 * GitHub answers both rate limits with `403` or `429`. A primary limit sets
 * `x-ratelimit-remaining: 0`, and a secondary limit says so in the message.
 * Any other `403` is a permission error.
 */
const rateLimit = (
  response: HttpClientResponse.HttpClientResponse,
  message: string,
  nowMillis: number,
): Option.Option<Retry> => {
  const retryAfter = Number(response.headers["retry-after"]);
  if (response.headers["retry-after"] !== undefined && Number.isFinite(retryAfter)) {
    return Option.some(
      new Retry({ reason: "rate_limit", message, wait: Option.some(Duration.seconds(retryAfter)) }),
    );
  }
  if (response.headers["x-ratelimit-remaining"] === "0") {
    const resetMillis = Number(response.headers["x-ratelimit-reset"]) * 1000;
    const wait = Number.isFinite(resetMillis)
      ? Option.some(Duration.millis(Math.max(resetMillis - nowMillis, 0) + 1000))
      : Option.none();
    return Option.some(new Retry({ reason: "rate_limit", message, wait }));
  }
  if (response.status === 429 || /rate limit/i.test(message)) {
    return Option.some(new Retry({ reason: "rate_limit", message, wait: Option.none() }));
  }
  return Option.none();
};

const backoff = (retry: Retry, attempt: number): Effect.Effect<Duration.Duration> =>
  Option.match(retry.wait, {
    onSome: Effect.succeed,
    onNone: () =>
      Random.nextBetween(0.8, 1.2).pipe(
        Effect.map((jitter) =>
          Duration.times(
            retry.reason === "rate_limit" ? rateLimitBaseDelay : retryBaseDelay,
            2 ** attempt * jitter,
          ),
        ),
      ),
  });

/** Waits as long as the error says, or backs off, and records each retry. */
const retrySchedule = Schedule.recurs(maxRetries).pipe(
  Schedule.modifyDelay(({ input, attempt }) =>
    input instanceof Retry ? backoff(input, attempt - 1) : Effect.succeed(Duration.zero),
  ),
  Schedule.tap(({ input }) =>
    input instanceof Retry
      ? Metrics.recordApiRetry({ connector: manifest.name, reason: input.reason })
      : Effect.void,
  ),
);

export const make = Effect.fnUntraced(function* () {
  const auth = yield* GitHubAuth.GitHubAuth;
  const client = yield* HttpClient.HttpClient;

  const statusError = (response: HttpClientResponse.HttpClientResponse, path: string) =>
    Effect.gen(function* () {
      const detail = yield* errorMessage(response);
      const message = `GitHub API returned ${response.status} for ${path}${detail ? `: ${detail}` : ""}`;
      if (response.status === 403 || response.status === 429) {
        const limited = rateLimit(response, message, yield* Clock.currentTimeMillis);
        if (Option.isSome(limited)) return yield* limited.value;
      }
      if (response.status === 408 || response.status >= 500) {
        return yield* new Retry({
          reason: response.status === 408 ? "timeout" : "server_error",
          message,
          wait: Option.none(),
        });
      }
      if (response.status === 401) return yield* new Unauthorized({ message });
      return yield* new ConnectorError({ message });
    });

  const attempt = <A>(schema: Schema.Decoder<A>, url: string, path: string) =>
    Effect.gen(function* () {
      const token = yield* auth.get;
      const request = HttpClientRequest.get(url).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.acceptJson,
        HttpClientRequest.setHeader("X-GitHub-Api-Version", GITHUB_API_VERSION),
      );
      const response = yield* client.execute(request).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_http", error)),
        Effect.mapError(
          () =>
            new Retry({
              reason: "transport",
              message: `GitHub API request failed for ${path}`,
              wait: Option.none(),
            }),
        ),
      );
      if (response.status < 200 || response.status >= 300) {
        return yield* statusError(response, path);
      }
      const body = yield* HttpClientResponse.schemaBodyJson(schema)(response).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_decode", error)),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: Schema.isSchemaError(error)
                ? `GitHub API response for ${path} does not match the schema`
                : `GitHub API returned invalid JSON for ${path}`,
              cause: error,
            }),
        ),
      );
      return { body, next: nextLink(response.headers.link) };
    }).pipe(
      Effect.timeoutOrElse({
        duration: requestTimeout,
        orElse: () =>
          Effect.fail(
            new Retry({
              reason: "timeout",
              message: `GitHub API request timed out for ${path}`,
              wait: Option.none(),
            }),
          ),
      }),
    );

  const get = <A>(
    schema: Schema.Decoder<A>,
    url: string,
  ): Effect.Effect<GitHubPage<A>, ConnectorError> => {
    const fullUrl = url.startsWith("/") ? `${baseUrl}${url}` : url;
    // `next` URLs come from GitHub, but never send the token anywhere else.
    if (!fullUrl.startsWith(`${baseUrl}/`)) {
      return Effect.fail(new ConnectorError({ message: `Not a GitHub API URL: ${url}` }));
    }
    const path = fullUrl.slice(baseUrl.length).split("?")[0] ?? fullUrl;

    const run = attempt(schema, fullUrl, path).pipe(
      Effect.retry({ schedule: retrySchedule, while: (error) => error._tag === "Retry" }),
      Effect.catchTag("Retry", ({ message }) => Effect.fail(new ConnectorError({ message }))),
    );

    // A revoked token stays cached until it expires, so get a new one once.
    return run.pipe(
      Effect.catchTag("Unauthorized", () => auth.invalidate.pipe(Effect.andThen(run))),
      Effect.catchTag("Unauthorized", ({ message }) =>
        Effect.fail(new ConnectorError({ message })),
      ),
      Effect.tapError((error) => Telemetry.annotateError("api_status", error)),
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: {
          [Telemetry.Attr.apiPath]: path,
          "github.api.version": GITHUB_API_VERSION,
        },
      }),
    );
  };

  return GitHubClient.of({ get });
});

export const layer = (
  config: GitHubConfig,
): Layer.Layer<GitHubClient, never, HttpClient.HttpClient> =>
  Layer.effect(GitHubClient)(make()).pipe(Layer.provide(GitHubAuth.layer(config)));

export const layerConfig = (
  config: Config.Wrap<GitHubConfig>,
): Layer.Layer<GitHubClient, Config.ConfigError, HttpClient.HttpClient> =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
