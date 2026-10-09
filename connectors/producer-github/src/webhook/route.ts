import { type ResourceDefinition, Webhook } from "@useairfoil/connector-kit";
import { Effect, Option, Result, Schema } from "effect";
import { HttpServerResponse } from "effect/http";

import { InstallationEventSchema, WebhookPayloadSchema } from "../schemas/events";
import { verifySignature } from "./signature";

export const webhookPath = "/webhooks/github";

export const makeWebhookRoute = (options: {
  readonly secret: string;
  readonly installationId: number;
  /** Resources by `X-GitHub-Event` name. */
  readonly targets: ReadonlyMap<string, ResourceDefinition>;
}) =>
  Webhook.route({
    path: webhookPath,
    ackMode: "after-enqueue",
    schema: WebhookPayloadSchema,
    handler: ({ request, rawBody, payload, to }) =>
      Effect.gen(function* () {
        const verified = yield* verifySignature({
          rawBody,
          header: request.headers["x-hub-signature-256"],
          secret: options.secret,
        }).pipe(Effect.result);
        if (Result.isFailure(verified)) {
          return HttpServerResponse.jsonUnsafe(
            { ok: false, error: verified.failure.message },
            { status: 401 },
          );
        }

        // One app can be installed on several accounts, and all of their events
        // come to the same URL. Only ours are stored. `ping` has no installation.
        const installationId = Schema.decodeUnknownOption(InstallationEventSchema)(payload).pipe(
          Option.flatMap(({ installation }) => Option.fromNullishOr(installation?.id)),
        );
        const resource = options.targets.get(request.headers["x-github-event"] ?? "");
        if (resource !== undefined && Option.contains(installationId, options.installationId)) {
          yield* to(resource, payload);
        }

        return HttpServerResponse.jsonUnsafe({ ok: true });
      }),
  });
