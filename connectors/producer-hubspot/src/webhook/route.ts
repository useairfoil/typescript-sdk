import { type ConnectorError, type ResourceDefinition, Webhook } from "@useairfoil/connector-kit";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import { HttpServerResponse } from "effect/http";

import type { RecordEvents } from "../resources/crm/webhook";

import { type HubSpotEvent, HubSpotEventSchema, WebhookPayloadSchema } from "../schemas/events";
import { verifySignature } from "./signature";

export const webhookPath = "/webhooks/hubspot";

const decodeEvent = Schema.decodeUnknownOption(HubSpotEventSchema);

const contactTypeId = "0-1";

type RecordEvent = RecordEvents[number] & { readonly typeId: string };

/** What each event asks of the resources. Other events are skipped. */
const recordEvents = (event: HubSpotEvent): ReadonlyArray<RecordEvent> => {
  const objectType = event.objectTypeId;
  const record = (
    typeId: string,
    id: string,
    deleted: boolean,
    linkedTo?: string,
  ): RecordEvent => ({
    typeId,
    id,
    deleted,
    ...(linkedTo === undefined ? {} : { linkedTo }),
  });
  switch (event.subscriptionType) {
    case "contact.privacyDeletion":
      return event.objectId === undefined ? [] : [record(contactTypeId, event.objectId, true)];
    case "object.creation":
    case "object.restore":
    case "object.propertyChange":
      return objectType === undefined || event.objectId === undefined
        ? []
        : [record(objectType, event.objectId, false)];
    case "object.deletion":
      return objectType === undefined || event.objectId === undefined
        ? []
        : [record(objectType, event.objectId, true)];
    case "object.merge": {
      if (objectType === undefined) return [];
      const kept = event.newObjectId ?? event.primaryObjectId ?? event.objectId;
      return [
        ...(event.mergedObjectIds ?? [])
          .filter((id) => id !== kept)
          .map((id) => record(objectType, id, true)),
        ...(kept === undefined ? [] : [record(objectType, kept, false)]),
      ];
    }
    case "object.associationChange": {
      const { fromObjectTypeId: from, fromObjectId, toObjectTypeId: to, toObjectId } = event;
      return from === undefined ||
        to === undefined ||
        fromObjectId === undefined ||
        toObjectId === undefined
        ? []
        : [record(from, fromObjectId, false, to), record(to, toObjectId, false, from)];
    }
    default:
      return [];
  }
};

/** The URL HubSpot called. A proxy in front keeps the original host and scheme in headers. */
const requestUrl = (headers: Readonly<Record<string, string | undefined>>, path: string) => {
  const proto = headers["x-forwarded-proto"]?.split(",")[0]?.trim() ?? "https";
  const host = headers["x-forwarded-host"]?.split(",")[0]?.trim() ?? headers.host ?? "";
  return `${proto}://${host}${path}`;
};

export const makeWebhookRoute = (options: {
  readonly secret: string;
  /** The connector's HubSpot account. Events from other accounts are skipped. */
  readonly portalId: Effect.Effect<number, ConnectorError>;
  /** CRM resources by object type ID, such as `0-1`. */
  readonly targets: ReadonlyMap<string, ResourceDefinition>;
}) =>
  Webhook.route({
    path: webhookPath,
    ackMode: "after-enqueue",
    schema: WebhookPayloadSchema,
    handler: ({ request, rawBody, payload, to }) =>
      Effect.gen(function* () {
        const verified = yield* verifySignature({
          method: request.method,
          url: requestUrl(request.headers, request.url),
          rawBody,
          signature: request.headers["x-hubspot-signature-v3"],
          timestamp: request.headers["x-hubspot-request-timestamp"],
          secret: options.secret,
        }).pipe(Effect.result);
        if (Result.isFailure(verified)) {
          return HttpServerResponse.jsonUnsafe(
            { ok: false, error: verified.failure.message },
            { status: 401 },
          );
        }

        const portalId = yield* options.portalId;
        const byType = Arr.groupBy(
          payload
            .flatMap((value) => Option.toArray(decodeEvent(value)))
            .filter((event) => event.portalId === portalId)
            .flatMap(recordEvents),
          (event) => event.typeId,
        );
        yield* Effect.forEach(
          Object.entries(byType),
          ([typeId, events]) => {
            const resource = options.targets.get(typeId);
            return resource === undefined ? Effect.void : to(resource, events);
          },
          { concurrency: "unbounded", discard: true },
        );

        return HttpServerResponse.jsonUnsafe({ ok: true });
      }),
  });
