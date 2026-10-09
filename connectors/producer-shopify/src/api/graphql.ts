import { ConnectorError, Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Data, Duration, Effect, Option, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { manifest, type ShopifyConfig } from "../manifest";
import * as ShopifyAuth from "./auth";
import { retrySchedule } from "./http";

// Keep this version aligned with the queries and webhook schemas.
export const SHOPIFY_API_VERSION = "2026-07";

const maxRetries = 5;
const retryBaseDelay = Duration.millis(200);
const graphqlRetryBaseDelay = Duration.millis(500);
const requestTimeout = Duration.minutes(2);

// Shopify reports GraphQL throttling in HTTP 200 responses.
// https://shopify.dev/docs/api/usage/limits
const ThrottleStatusSchema = Schema.Struct({
  maximumAvailable: Schema.Number,
  currentlyAvailable: Schema.Number,
  restoreRate: Schema.Number,
});

const GraphQLResponseSchema = Schema.Struct({
  data: Schema.optional(Schema.Unknown),
  errors: Schema.optional(
    Schema.Array(
      Schema.Struct({
        extensions: Schema.optional(Schema.Struct({ code: Schema.optional(Schema.String) })),
      }),
    ),
  ),
  extensions: Schema.optional(
    Schema.Struct({
      cost: Schema.optional(
        Schema.Struct({
          requestedQueryCost: Schema.optional(Schema.Number),
          throttleStatus: Schema.optional(ThrottleStatusSchema),
        }),
      ),
    }),
  ),
});

type GraphQLResponse = Schema.Schema.Type<typeof GraphQLResponseSchema>;

type RetryableCode = "THROTTLED" | "INTERNAL_SERVER_ERROR";

const retryableCodes: ReadonlySet<string> = new Set(["THROTTLED", "INTERNAL_SERVER_ERROR"]);

/** A code only when every error can be retried. */
const retryableCode = (
  errors: NonNullable<GraphQLResponse["errors"]>,
): Option.Option<RetryableCode> => {
  const codes = errors.map((error) => error.extensions?.code);
  if (!codes.every((code) => code !== undefined && retryableCodes.has(code))) {
    return Option.none();
  }
  return Option.some(codes.includes("THROTTLED") ? "THROTTLED" : "INTERNAL_SERVER_ERROR");
};

/** How long Shopify needs to restore the query's cost, when it says so. */
const throttleWait = (response: GraphQLResponse): Option.Option<Duration.Duration> => {
  const cost = response.extensions?.cost;
  const status = cost?.throttleStatus;
  if (cost?.requestedQueryCost === undefined || status === undefined || status.restoreRate <= 0) {
    return Option.none();
  }
  const deficit = Math.max(0, cost.requestedQueryCost - status.currentlyAvailable);
  return Option.some(Duration.millis(Math.ceil((deficit / status.restoreRate) * 1000)));
};

/** GraphQL errors that can all be retried. */
class Retryable extends Data.TaggedError("Retryable")<{
  readonly code: RetryableCode;
  readonly wait: Option.Option<Duration.Duration>;
  readonly body: unknown;
}> {}

/** Shopify rejected the token. A new one is tried once. */
class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly body: unknown }> {}

export const make = Effect.fnUntraced(function* (config: ShopifyConfig) {
  const auth = yield* ShopifyAuth.ShopifyAuth;
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequestEffect((request) =>
      auth.get.pipe(
        Effect.map((token) =>
          HttpClientRequest.setHeader(request, "X-Shopify-Access-Token", Redacted.value(token)),
        ),
      ),
    ),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
    HttpClient.retryTransient({
      schedule: retrySchedule({ maxRetries, baseDelay: retryBaseDelay }),
    }),
  );
  const endpoint = `${ShopifyAuth.shopUrl(config.shopDomain)}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  // A throttled query waits until Shopify restores its cost. Others back off.
  const graphqlRetrySchedule = Schedule.exponential(graphqlRetryBaseDelay).pipe(
    Schedule.jittered,
    Schedule.upTo({ times: maxRetries }),
    Schedule.modifyDelay(({ input, duration }) =>
      Effect.succeed(
        input instanceof Retryable
          ? Option.match(input.wait, {
              onNone: () => duration,
              onSome: (wait) => Duration.max(wait, graphqlRetryBaseDelay),
            })
          : duration,
      ),
    ),
  );

  const fetchGraphQL = <A>(options: {
    readonly operationName: string;
    readonly query: string;
    readonly variables?: Record<string, unknown>;
    readonly schema: Schema.Decoder<A>;
  }): Effect.Effect<A, ConnectorError> => {
    const fail = (message: string, cause: unknown, annotation: string) =>
      Effect.logWarning(message).pipe(
        Effect.annotateLogs({
          operationName: options.operationName,
          body: JSON.stringify(cause),
        }),
        Effect.andThen(Telemetry.annotateError(annotation, cause)),
        Effect.andThen(Effect.fail(new ConnectorError({ message, cause }))),
      );

    const decodeError = (error: Schema.SchemaError) =>
      Telemetry.annotateError("api_decode", error).pipe(
        Effect.andThen(
          Effect.fail(
            new ConnectorError({
              message: "Shopify GraphQL response schema decode failed",
              cause: error,
            }),
          ),
        ),
      );

    const attempt = Effect.gen(function* () {
      const request = HttpClientRequest.post(endpoint).pipe(
        HttpClientRequest.bodyJsonUnsafe({
          query: options.query,
          variables: options.variables ?? {},
        }),
      );
      const response = yield* client.execute(request).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_http", error)),
        Effect.mapError((error) =>
          error._tag === "ShopifyAuthError"
            ? new ConnectorError({ message: error.message, cause: error })
            : new ConnectorError({ message: "Shopify GraphQL request failed", cause: error }),
        ),
      );
      const body = yield* response.json.pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_json", error)),
        Effect.mapError(
          (error) =>
            new ConnectorError({ message: "Shopify GraphQL returned invalid JSON", cause: error }),
        ),
      );

      if (response.status === 401) return yield* new Unauthorized({ body });
      if (response.status < 200 || response.status >= 300) {
        return yield* fail(
          "Shopify GraphQL returned non-2xx status",
          { status: response.status, body, operationName: options.operationName },
          "api_status",
        );
      }

      const graphql = yield* Schema.decodeUnknownEffect(GraphQLResponseSchema)(body).pipe(
        Effect.catch(decodeError),
      );
      if (graphql.errors !== undefined && graphql.errors.length > 0) {
        const code = retryableCode(graphql.errors);
        if (Option.isSome(code)) {
          return yield* new Retryable({
            code: code.value,
            wait: code.value === "THROTTLED" ? throttleWait(graphql) : Option.none(),
            body,
          });
        }
        return yield* fail("Shopify GraphQL returned errors", body, "api_graphql");
      }
      return yield* Schema.decodeUnknownEffect(options.schema)(graphql.data).pipe(
        Effect.catch(decodeError),
      );
    }).pipe(
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: { [Telemetry.Attr.apiPath]: `graphql:${options.operationName}` },
      }),
    );

    const run = attempt.pipe(
      Effect.retry({
        schedule: graphqlRetrySchedule.pipe(
          Schedule.tap(({ input, duration }) =>
            input instanceof Retryable
              ? Effect.logWarning(
                  "Shopify GraphQL request returned a retryable error, retrying",
                ).pipe(
                  Effect.annotateLogs({
                    operationName: options.operationName,
                    code: input.code,
                    waitMillis: Duration.toMillis(duration),
                  }),
                  Effect.andThen(
                    Metrics.recordApiRetry({
                      connector: manifest.name,
                      reason: input.code === "THROTTLED" ? "rate_limit" : "server_error",
                    }),
                  ),
                )
              : Effect.void,
          ),
        ),
        while: (error) => error._tag === "Retryable",
      }),
      Effect.catchTag("Retryable", (error) =>
        fail("Shopify GraphQL returned errors", error.body, "api_graphql"),
      ),
    );

    return run.pipe(
      // A revoked token stays cached until it expires, so get a new one once.
      Effect.catchTag("Unauthorized", () => auth.invalidate.pipe(Effect.andThen(run))),
      Effect.catchTag("Unauthorized", (error) =>
        fail(
          "Shopify GraphQL returned non-2xx status",
          { status: 401, body: error.body, operationName: options.operationName },
          "api_status",
        ),
      ),
      Effect.timeoutOrElse({
        duration: requestTimeout,
        orElse: () =>
          Effect.fail(new ConnectorError({ message: "Shopify GraphQL request timed out" })),
      }),
    );
  };

  return fetchGraphQL;
});
