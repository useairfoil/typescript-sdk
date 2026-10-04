import { ConnectorError, Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Duration, Effect, Option, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { manifest, type ShopifyConfig } from "../manifest";
import * as ShopifyAuth from "./auth";
import { backoff, withTransientRetry } from "./http";

// Shopify reports GraphQL throttling in HTTP 200 responses.
// https://shopify.dev/docs/api/usage/limits
const ThrottleStatusSchema = Schema.Struct({
  maximumAvailable: Schema.Number,
  currentlyAvailable: Schema.Number,
  restoreRate: Schema.Number,
});

export type ThrottleStatus = Schema.Schema.Type<typeof ThrottleStatusSchema>;

const GraphQLErrorSchema = Schema.Struct({
  extensions: Schema.optional(Schema.Struct({ code: Schema.optional(Schema.String) })),
});

const GraphQLEnvelopeSchema = Schema.Struct({
  errors: Schema.optional(Schema.Array(GraphQLErrorSchema)),
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

const decodeEnvelope = Schema.decodeUnknownOption(GraphQLEnvelopeSchema);

const readThrottleCost = (
  body: unknown,
): { readonly requestedQueryCost: number; readonly status: ThrottleStatus } | undefined =>
  decodeEnvelope(body).pipe(
    Option.flatMap((envelope) => {
      const cost = envelope.extensions?.cost;
      const status = cost?.throttleStatus;
      const requestedQueryCost = cost?.requestedQueryCost;
      return status === undefined || requestedQueryCost === undefined
        ? Option.none()
        : Option.some({ requestedQueryCost, status });
    }),
    Option.getOrUndefined,
  );

const retryableCodes = new Set(["THROTTLED", "INTERNAL_SERVER_ERROR"]);

export type RetryableErrorCode = "THROTTLED" | "INTERNAL_SERVER_ERROR";

/** Returns a code only when every error can be retried. */
export const retryableErrorCode = (body: unknown): RetryableErrorCode | undefined =>
  decodeEnvelope(body).pipe(
    Option.flatMap((envelope) => {
      const codes = envelope.errors?.map((error) => error.extensions?.code) ?? [];
      const allRetryable =
        codes.length > 0 && codes.every((code) => code !== undefined && retryableCodes.has(code));
      if (!allRetryable) return Option.none<RetryableErrorCode>();
      return Option.some<RetryableErrorCode>(
        codes.includes("THROTTLED") ? "THROTTLED" : "INTERNAL_SERVER_ERROR",
      );
    }),
    Option.getOrUndefined,
  );

/** Waits out the cost deficit when throttled. Otherwise backs off. */
export const retryDelay = (
  code: RetryableErrorCode,
  body: unknown,
  attempt: number,
  options: { readonly baseDelay: Duration.Duration },
): Effect.Effect<Duration.Duration> => {
  if (code === "INTERNAL_SERVER_ERROR") return backoff(options.baseDelay, attempt);
  const cost = readThrottleCost(body);
  if (cost === undefined || cost.status.restoreRate <= 0) {
    return backoff(options.baseDelay, attempt);
  }
  const deficitMillis =
    (Math.max(0, cost.requestedQueryCost - cost.status.currentlyAvailable) /
      cost.status.restoreRate) *
    1000;
  return Effect.succeed(Duration.max(Duration.millis(Math.ceil(deficitMillis)), options.baseDelay));
};

const graphqlEndpoint = (config: ShopifyConfig): string => {
  const shopDomain = config.shopDomain.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
  return `https://${shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
};

const hasGraphqlErrors = (body: unknown): boolean => {
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return false;
  }
  return Array.isArray(body.errors) && body.errors.length > 0;
};

const summarizeBody = (body: unknown): string => {
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
};

export const make = Effect.fnUntraced(function* (config: ShopifyConfig) {
  const auth = yield* ShopifyAuth.ShopifyAuth;
  const retryBaseDelay = Duration.millis(config.retryBaseDelayMs);
  const graphqlRetryBaseDelay = Duration.millis(config.graphqlRetryBaseDelayMs);
  const requestTimeout = Duration.seconds(config.requestTimeoutSeconds);
  const transportRetrySchedule = Schedule.exponential(retryBaseDelay).pipe(
    Schedule.jittered,
    Schedule.upTo({ times: config.transportMaxRetries }),
    Schedule.tap(() => Metrics.recordApiRetry({ connector: manifest.name, reason: "transport" })),
  );
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequestEffect((request) =>
      auth.get.pipe(
        Effect.map((token) =>
          HttpClientRequest.setHeader(request, "X-Shopify-Access-Token", Redacted.value(token)),
        ),
      ),
    ),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
    (c) =>
      withTransientRetry(c, {
        maxRetries: config.responseMaxRetries,
        baseDelay: retryBaseDelay,
        retryAfterFallback: Duration.seconds(config.retryAfterFallbackSeconds),
      }),
    // Responses are retried above. This only retries transport errors.
    HttpClient.retryTransient({
      retryOn: "errors-only",
      schedule: transportRetrySchedule,
    }),
  );
  const endpoint = graphqlEndpoint(config);

  const fetchGraphQL = <A>(options: {
    readonly operationName: string;
    readonly query: string;
    readonly variables?: Record<string, unknown>;
    readonly schema: Schema.Decoder<A>;
  }): Effect.Effect<A, ConnectorError> => {
    const attempt = (
      remainingRetries: number,
      tokenRefreshed: boolean,
    ): Effect.Effect<A, ConnectorError> =>
      Effect.gen(function* () {
        const request = yield* HttpClientRequest.post(endpoint).pipe(
          HttpClientRequest.bodyJson({
            query: options.query,
            variables: options.variables ?? {},
          }),
          Effect.mapError(
            (cause) =>
              new ConnectorError({ message: "Failed to encode Shopify GraphQL request", cause }),
          ),
        );

        const { body, status } = yield* Effect.scoped(
          client.execute(request).pipe(
            Effect.tapError((error) => Telemetry.annotateError("api_http", error)),
            Effect.mapError((error) => {
              if (error._tag === "ShopifyAuthError") {
                return new ConnectorError({ message: error.message, cause: error });
              }
              return new ConnectorError({
                message: "Shopify GraphQL request failed",
                cause: error,
              });
            }),
            Effect.flatMap((response) =>
              response.json.pipe(
                Effect.tapError((error) => Telemetry.annotateError("api_json", error)),
                Effect.mapError(
                  (error) =>
                    new ConnectorError({
                      message: "Shopify GraphQL returned invalid JSON",
                      cause: error,
                    }),
                ),
                Effect.map((body) => ({
                  body,
                  status: response.status,
                })),
              ),
            ),
          ),
        );

        // A revoked token stays cached until it expires, so get a new one once.
        if (status === 401 && !tokenRefreshed) {
          yield* auth.invalidate;
          return yield* attempt(remainingRetries, true);
        }

        if (status < 200 || status >= 300) {
          const error = { status, body, operationName: options.operationName };
          yield* Effect.logWarning("Shopify GraphQL returned non-2xx status").pipe(
            Effect.annotateLogs({
              operationName: options.operationName,
              status,
              body: summarizeBody(body),
            }),
          );
          yield* Telemetry.annotateError("api_status", error);
          return yield* Effect.fail(
            new ConnectorError({
              message: "Shopify GraphQL returned non-2xx status",
              cause: error,
            }),
          );
        }

        if (hasGraphqlErrors(body)) {
          const retryableCode = retryableErrorCode(body);
          if (retryableCode !== undefined && remainingRetries > 0) {
            const attemptIndex = config.graphqlMaxRetries - remainingRetries;
            const wait = yield* retryDelay(retryableCode, body, attemptIndex, {
              baseDelay: graphqlRetryBaseDelay,
            });
            yield* Effect.logWarning(
              "Shopify GraphQL request returned a retryable error, retrying",
            ).pipe(
              Effect.annotateLogs({
                operationName: options.operationName,
                code: retryableCode,
                remainingRetries,
                waitMillis: Duration.toMillis(wait),
              }),
            );
            yield* Metrics.recordApiRetry({
              connector: manifest.name,
              reason: retryableCode === "THROTTLED" ? "rate_limit" : "server_error",
            });
            yield* Effect.sleep(wait);
            return yield* attempt(remainingRetries - 1, tokenRefreshed);
          }

          yield* Effect.logWarning("Shopify GraphQL returned errors").pipe(
            Effect.annotateLogs({
              operationName: options.operationName,
              body: summarizeBody(body),
            }),
          );
          yield* Telemetry.annotateError("api_graphql", body);
          return yield* Effect.fail(
            new ConnectorError({ message: "Shopify GraphQL returned errors", cause: body }),
          );
        }

        const data =
          typeof body === "object" && body !== null && "data" in body ? body.data : undefined;
        return yield* Schema.decodeUnknownEffect(options.schema)(data).pipe(
          Effect.tapError((error) => Telemetry.annotateError("api_decode", error)),
          Effect.mapError(
            (error) =>
              new ConnectorError({
                message: "Shopify GraphQL response schema decode failed",
                cause: error,
              }),
          ),
        );
      }).pipe(
        Effect.withSpan(Telemetry.SpanName.apiFetch, {
          kind: "client",
          attributes: { [Telemetry.Attr.apiPath]: `graphql:${options.operationName}` },
        }),
      );

    return attempt(config.graphqlMaxRetries, false).pipe(
      Effect.timeoutOrElse({
        duration: requestTimeout,
        orElse: () =>
          Effect.fail(new ConnectorError({ message: "Shopify GraphQL request timed out" })),
      }),
    );
  };

  return fetchGraphQL;
});
