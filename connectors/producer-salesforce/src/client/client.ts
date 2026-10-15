import { ConnectorError, Metrics, Telemetry } from "@useairfoil/connector-kit";
import { Config, Context, Data, DateTime, Duration, Effect, Layer, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { type SalesforceConfig, manifest } from "../manifest";
import * as SalesforceAuth from "./auth";

// Keep this version aligned with the README.
export const SALESFORCE_API_VERSION = "68.0";

const maxRetries = 5;
const retryBaseDelay = Duration.seconds(1);
const requestTimeout = Duration.minutes(2);
// Both API limits clear on their own (the daily one is a rolling 24 hours), so
// wait instead of failing. A failed source stays stopped until restart.
const limitRetry = Schedule.min([Schedule.exponential("1 minute"), Schedule.spaced("30 minutes")]);

export type SalesforceResponse<A> = {
  readonly body: A;
  /** When the response arrived. Used as the row version. */
  readonly fetchedAt: Date;
};

export type SalesforceClientService = {
  /** Paths are relative to `/services/data/v68.0`. */
  readonly get: <A>(
    schema: Schema.Decoder<A>,
    path: string,
    params?: Readonly<Record<string, string>>,
  ) => Effect.Effect<SalesforceResponse<A>, ConnectorError>;
  readonly post: <A>(
    schema: Schema.Decoder<A>,
    path: string,
    body: unknown,
  ) => Effect.Effect<SalesforceResponse<A>, ConnectorError>;
};

export class SalesforceClient extends Context.Service<SalesforceClient, SalesforceClientService>()(
  "@useairfoil/producer-salesforce/SalesforceClient",
) {}

const ErrorBodySchema = Schema.Array(
  Schema.Struct({ message: Schema.String, errorCode: Schema.String }),
);

/** The org's daily or concurrent API limit is used up. */
class RequestLimitExceeded extends Data.TaggedError("RequestLimitExceeded")<{
  readonly message: string;
}> {}

/** Salesforce puts the reason in the body, such as `REQUEST_LIMIT_EXCEEDED`. */
const statusError = (response: HttpClientResponse.HttpClientResponse, path: string) =>
  HttpClientResponse.schemaBodyJson(ErrorBodySchema)(response).pipe(
    Effect.orElseSucceed(() => []),
    Effect.flatMap((errors): Effect.Effect<never, ConnectorError | RequestLimitExceeded> => {
      const detail = errors.map((error) => `${error.errorCode}: ${error.message}`).join("; ");
      const message = `Salesforce API returned ${response.status} for ${path}${detail ? `: ${detail}` : ""}`;
      return errors.some((error) => error.errorCode === "REQUEST_LIMIT_EXCEEDED")
        ? Effect.fail(new RequestLimitExceeded({ message }))
        : Effect.fail(new ConnectorError({ message }));
    }),
    Effect.tapError((error) => Telemetry.annotateError("api_status", error)),
  );

export const make = Effect.fnUntraced(function* (config: SalesforceConfig) {
  const auth = yield* SalesforceAuth.SalesforceAuth;
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.prependUrl(
          `https://${config.domain}/services/data/v${SALESFORCE_API_VERSION}`,
        ),
        HttpClientRequest.acceptJson,
      ),
    ),
    HttpClient.mapRequestEffect((request) =>
      auth.get.pipe(Effect.map((token) => HttpClientRequest.bearerToken(request, token))),
    ),
    HttpClient.retryTransient({
      schedule: Metrics.retrySchedule({
        connector: manifest.name,
        baseDelay: retryBaseDelay,
        times: maxRetries,
      }),
    }),
  );

  const execute = <A>(
    schema: Schema.Decoder<A>,
    request: HttpClientRequest.HttpClientRequest,
    path: string,
  ): Effect.Effect<SalesforceResponse<A>, ConnectorError> =>
    Effect.gen(function* () {
      const response = yield* client.execute(request).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_http", error)),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: `Salesforce API request failed for ${path}`,
              cause: error,
            }),
        ),
      );
      // After retries, so the version matches the data.
      const fetchedAt = yield* DateTime.nowAsDate;
      if (response.status < 200 || response.status >= 300) {
        return yield* statusError(response, path);
      }
      const body = yield* HttpClientResponse.schemaBodyJson(schema)(response).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_decode", error)),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: `Could not decode Salesforce API response for ${path}`,
              cause: error,
            }),
        ),
      );
      return { body, fetchedAt };
    }).pipe(
      Effect.timeoutOrElse({
        duration: requestTimeout,
        orElse: () =>
          Effect.fail(
            new ConnectorError({ message: `Salesforce API request timed out for ${path}` }),
          ),
      }),
      Effect.retry({
        schedule: limitRetry.pipe(
          Schedule.tap(({ duration }) =>
            Effect.logWarning("Salesforce API limit reached, waiting to try again").pipe(
              Effect.annotateLogs({ path, waitMillis: Duration.toMillis(duration) }),
            ),
          ),
        ),
        while: (error) => error._tag === "RequestLimitExceeded",
      }),
      Effect.catchTag("RequestLimitExceeded", (error) =>
        Effect.fail(new ConnectorError({ message: error.message })),
      ),
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: {
          [Telemetry.Attr.apiPath]: path,
          "salesforce.api.version": SALESFORCE_API_VERSION,
        },
      }),
    );

  const get = <A>(
    schema: Schema.Decoder<A>,
    path: string,
    params: Readonly<Record<string, string>> = {},
  ) =>
    execute(schema, HttpClientRequest.get(path).pipe(HttpClientRequest.setUrlParams(params)), path);

  const post = <A>(schema: Schema.Decoder<A>, path: string, body: unknown) =>
    execute(
      schema,
      HttpClientRequest.post(path).pipe(HttpClientRequest.bodyJsonUnsafe(body)),
      path,
    );

  return SalesforceClient.of({ get, post });
});

export const layer = (
  config: SalesforceConfig,
): Layer.Layer<SalesforceClient, never, HttpClient.HttpClient> =>
  Layer.effect(SalesforceClient)(make(config)).pipe(Layer.provide(SalesforceAuth.layer(config)));

export const layerConfig = (
  config: Config.Wrap<SalesforceConfig>,
): Layer.Layer<SalesforceClient, Config.ConfigError, HttpClient.HttpClient> =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
