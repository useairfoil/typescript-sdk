import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list } from "./shared";

export const TicketCommentSchema = Schema.Struct({
  id: Long.pipe(field(1, "Comment ID.")),
  version: Schema.Date.pipe(field(2, "Time of the ticket update that changed the comment last.")),
  ticket_id: Long.pipe(field(3, "Ticket the comment is on.")),
  type: Schema.String.pipe(field(4, "Comment or VoiceComment.")),
  author_id: Long.pipe(field(5, "User who wrote the comment.")),
  public: Schema.Boolean.pipe(
    field(6, "Whether the requester can see it. False for internal notes."),
  ),
  created_at: Timestamp.pipe(field(7, "Time the comment was added.")),
  via: Schema.Struct({
    channel: Schema.String.pipe(field(101, "Channel, such as email, web, or api.")),
  }).pipe(field(8, "How the comment was added.")),
  body: Schema.String.pipe(field(9, "Comment text. Redacted parts are ▇.")),
  attachments: list(
    102,
    Schema.Struct({
      id: Long.pipe(field(103, "Attachment ID.")),
      file_name: Schema.String.pipe(field(104, "File name.")),
      content_type: Schema.String.pipe(field(105, "MIME type.")),
      size: Long.pipe(field(106, "Size in bytes.")),
    }),
  ).pipe(field(10, "Attached files. Only their details, not the files.")),
}).annotate({ description: "Comments and internal notes on Zendesk tickets." });

export type TicketComment = Schema.Schema.Type<typeof TicketCommentSchema>;

export const CommentObjectSchema = TicketCommentSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "ticket_id"]),
);

export type CommentObject = Schema.Schema.Type<typeof CommentObjectSchema>;

export const isCommentEvent = Schema.is(
  Schema.Struct({ event_type: Schema.Literals(["Comment", "VoiceComment"]) }),
);

export const isRedactionEvent = Schema.is(
  Schema.Struct({
    event_type: Schema.Literals(["CommentRedactionEvent", "AttachmentRedactionEvent"]),
  }),
);

export const TicketEventSchema = Schema.Struct({
  ticket_id: Long,
  created_at: Timestamp,
  child_events: Schema.Array(Schema.Unknown),
});

export type TicketEvent = Schema.Schema.Type<typeof TicketEventSchema>;
