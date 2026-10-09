import { Auth, ConnectorError, Telemetry } from "@useairfoil/connector-kit";
import { Context, Duration, Effect, Layer, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import type { ZendeskConfig } from "../manifest";

import { baseUrl } from "./constants";

type ZendeskAuthConfig = Pick<ZendeskConfig, "subdomain" | "clientId" | "clientSecret">;

export type ZendeskAuthService = Auth.TokenCache<ConnectorError>;

export class ZendeskAuth extends Context.Service<ZendeskAuth, ZendeskAuthService>()(
  "@useairfoil/producer-zendesk/ZendeskAuth",
) {}

export const scopes = [
  "tickets:read",
  "users:read",
  "organizations:read",
  "groups:read",
  "brands:read",
  // `ticket_fields` needs it.
  "account_settings:read",
].join(" ");

// Older OAuth clients issue non-expiring tokens without expires_in.
const tokenLifetime = Duration.minutes(30);

const TokenResponseSchema = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Number,
});

const TokenErrorSchema = Schema.Struct({ error: Schema.optional(Schema.String) });

const tokenError = (response: HttpClientResponse.HttpClientResponse, subdomain: string) =>
  HttpClientResponse.schemaBodyJson(TokenErrorSchema)(response).pipe(
    Effect.map((body) => body.error),
    Effect.orElseSucceed(() => undefined),
    Effect.flatMap((error) =>
      Effect.fail(
        new ConnectorError({
          message:
            response.status === 404
              ? `No Zendesk account at ${baseUrl(subdomain)}`
              : error === "invalid_client"
                ? "Zendesk rejected the OAuth client ID or secret"
                : error === "invalid_scope"
                  ? `The Zendesk OAuth client must allow these scopes: ${scopes}`
                  : `Zendesk returned ${response.status} for the OAuth token`,
        }),
      ),
    ),
  );

export const make = Effect.fnUntraced(function* (config: ZendeskAuthConfig) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({
      schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
      times: 3,
    }),
  );
  const request = HttpClientRequest.post(`${baseUrl(config.subdomain)}/oauth/tokens`).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bodyJsonUnsafe({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: Redacted.value(config.clientSecret),
      scope: scopes,
      expires_in: Duration.toSeconds(tokenLifetime),
    }),
  );

  return yield* Auth.makeTokenCache({
    acquire: Effect.gen(function* () {
      const response = yield* client
        .execute(request)
        .pipe(
          Effect.mapError(
            (cause) => new ConnectorError({ message: "Zendesk OAuth token request failed", cause }),
          ),
        );
      const body = yield* HttpClientResponse.matchStatus(response, {
        "2xx": (ok) =>
          HttpClientResponse.schemaBodyJson(TokenResponseSchema)(ok).pipe(
            Effect.mapError(
              (cause) =>
                new ConnectorError({ message: "Invalid Zendesk OAuth token response", cause }),
            ),
          ),
        orElse: (response) => tokenError(response, config.subdomain),
      });
      return {
        value: Redacted.make(body.access_token),
        expiresIn: Duration.seconds(body.expires_in),
      };
    }).pipe(
      Effect.tapError((error) => Telemetry.annotateError("api_auth", error)),
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: { [Telemetry.Attr.apiPath]: "/oauth/tokens" },
      }),
    ),
  });
});

export const layer = (
  config: ZendeskAuthConfig,
): Layer.Layer<ZendeskAuth, never, HttpClient.HttpClient> =>
  Layer.effect(ZendeskAuth)(make(config));
