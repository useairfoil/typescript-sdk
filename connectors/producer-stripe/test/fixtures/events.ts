// The event parts we read, plus a few fields Stripe always sends.
export const event = (options: {
  readonly id: string;
  readonly type: string;
  readonly objectId: string;
  readonly created?: number;
}) => ({
  id: options.id,
  object: "event",
  api_version: "2025-03-31.basil",
  created: options.created ?? 1_767_225_600,
  data: { object: { id: options.objectId } },
  livemode: false,
  pending_webhooks: 0,
  request: { id: null, idempotency_key: null },
  type: options.type,
});
