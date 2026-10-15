import { Auth, ConnectorError, Telemetry } from "@useairfoil/connector-kit";
import { Context, Duration, Effect, Layer, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import type { SalesforceConfig } from "../manifest";

type SalesforceAuthConfig = Pick<SalesforceConfig, "domain" | "clientId" | "clientSecret">;

export type SalesforceAuthService = Auth.TokenCache<ConnectorError>;

export class SalesforceAuth extends Context.Service<SalesforceAuth, SalesforceAuthService>()(
  "@useairfoil/producer-salesforce/SalesforceAuth",
) {}

// The response has no expiry. A token lasts one session timeout from when it's
// issued, at least 15 minutes. The cache renews it halfway through.
const tokenLifetime = Duration.minutes(15);

const TokenResponseSchema = Schema.Struct({ access_token: Schema.String });

const TokenErrorSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
});

const tokenError = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(TokenErrorSchema)(response).pipe(
    Effect.map((body) => body.error_description ?? body.error),
    Effect.orElseSucceed(() => undefined),
    Effect.flatMap((detail) =>
      Effect.fail(
        new ConnectorError({
          message: `Salesforce returned ${response.status} for the OAuth token${detail ? `: ${detail}` : ""}`,
        }),
      ),
    ),
  );

export const make = Effect.fnUntraced(function* (config: SalesforceAuthConfig) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({
      schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
      times: 3,
    }),
  );
  // Salesforce takes the client ID and secret as Basic auth.
  const request = HttpClientRequest.post(`https://${config.domain}/services/oauth2/token`).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.basicAuth(config.clientId, Redacted.value(config.clientSecret)),
    HttpClientRequest.bodyUrlParams({ grant_type: "client_credentials" }),
  );

  return yield* Auth.makeTokenCache({
    acquire: Effect.gen(function* () {
      const response = yield* client
        .execute(request)
        .pipe(
          Effect.mapError(
            (cause) =>
              new ConnectorError({ message: "Salesforce OAuth token request failed", cause }),
          ),
        );
      const body = yield* HttpClientResponse.matchStatus(response, {
        "2xx": (ok) =>
          HttpClientResponse.schemaBodyJson(TokenResponseSchema)(ok).pipe(
            Effect.mapError(
              (cause) =>
                new ConnectorError({ message: "Invalid Salesforce OAuth token response", cause }),
            ),
          ),
        orElse: tokenError,
      });
      return { value: Redacted.make(body.access_token), expiresIn: tokenLifetime };
    }).pipe(
      Effect.tapError((error) => Telemetry.annotateError("api_auth", error)),
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: { [Telemetry.Attr.apiPath]: "/services/oauth2/token" },
      }),
    ),
  });
});

export const layer = (
  config: SalesforceAuthConfig,
): Layer.Layer<SalesforceAuth, never, HttpClient.HttpClient> =>
  Layer.effect(SalesforceAuth)(make(config));
