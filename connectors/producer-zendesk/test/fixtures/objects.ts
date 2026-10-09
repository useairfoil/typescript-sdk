// Shapes from a Zendesk trial account, trimmed, with test data.

export const ticket = (id: number, fields: Readonly<Record<string, unknown>> = {}) => ({
  url: `https://acme.zendesk.com/api/v2/tickets/${id}.json`,
  id,
  external_id: null,
  via: { channel: "api", source: { from: {}, to: {}, rel: null } },
  created_at: "2026-10-08T21:25:21Z",
  updated_at: "2026-10-08T21:25:28Z",
  generated_timestamp: 1791494764,
  type: "question",
  subject: "Billing question",
  raw_subject: "Billing question",
  description: "Billing question - first message",
  priority: "high",
  status: "solved",
  requester_id: 39771868857245,
  submitter_id: 39771868857245,
  assignee_id: 39771704393373,
  organization_id: 39771868840349,
  group_id: 39771663256989,
  collaborator_ids: [],
  problem_id: null,
  is_public: true,
  due_at: null,
  tags: ["billing", "vip"],
  custom_fields: [
    { id: 39771663108893, value: null },
    { id: 39771680543389, value: "topic__billing__invoice__request" },
    { id: 39771695973277, value: false },
    { id: 39771695973278, value: ["red", "blue"] },
  ],
  satisfaction_rating: { score: "unoffered" },
  custom_status_id: 39771663254173,
  ticket_form_id: 39771663206685,
  brand_id: 39771695429277,
  ...fields,
});

const minutes = (calendar: number | null, business: number | null) => ({ calendar, business });

export const metricSet = (ticketId: number) => ({
  url: "https://acme.zendesk.com/api/v2/ticket_metrics/39771696929565.json",
  id: 39771696929565,
  ticket_id: ticketId,
  created_at: "2026-10-08T21:25:21Z",
  updated_at: "2026-10-08T21:25:28Z",
  group_stations: 1,
  assignee_stations: 1,
  reopens: 0,
  replies: 2,
  status_updated_at: "2026-10-08T21:25:28Z",
  initially_assigned_at: "2026-10-08T21:25:21Z",
  assigned_at: "2026-10-08T21:25:21Z",
  solved_at: "2026-10-08T21:25:28Z",
  latest_comment_added_at: "2026-10-08T21:25:28Z",
  reply_time_in_minutes: minutes(4, 4),
  first_resolution_time_in_minutes: minutes(7, 7),
  full_resolution_time_in_minutes: minutes(7, 7),
  agent_wait_time_in_minutes: minutes(0, 0),
  requester_wait_time_in_minutes: minutes(7, 7),
  on_hold_time_in_minutes: minutes(0, 0),
});

export const user = (id: number, fields: Readonly<Record<string, unknown>> = {}) => ({
  id,
  url: `https://acme.zendesk.com/api/v2/users/${id}.json`,
  name: "Ada Test",
  email: "ada@acme.example",
  created_at: "2026-10-08T21:25:19Z",
  updated_at: "2026-10-08T21:25:19Z",
  time_zone: "Asia/Kolkata",
  locale: "en-US",
  organization_id: 39771868840349,
  role: "end-user",
  verified: false,
  external_id: null,
  tags: ["beta"],
  active: true,
  suspended: false,
  custom_role_id: null,
  default_group_id: null,
  last_login_at: null,
  user_fields: { plan: "pro", seats: 12, renewal: null },
  ...fields,
});

export const organization = (id: number, fields: Readonly<Record<string, unknown>> = {}) => ({
  url: `https://acme.zendesk.com/api/v2/organizations/${id}.json`,
  id,
  name: "Acme Test Co",
  shared_tickets: false,
  shared_comments: false,
  external_id: null,
  created_at: "2026-10-08T21:25:18Z",
  updated_at: "2026-10-08T21:25:18Z",
  domain_names: ["acme.example"],
  details: "",
  notes: "",
  group_id: null,
  tags: ["vip"],
  organization_fields: {},
  deleted_at: null,
  ...fields,
});

export const comment = (id: number, fields: Readonly<Record<string, unknown>> = {}) => ({
  id,
  via: { channel: "api", source: { from: {}, to: {}, rel: null } },
  type: "Comment",
  author_id: 39771704393373,
  body: "Thanks Ada, looking into it.",
  html_body: "<p>Thanks Ada, looking into it.</p>",
  plain_body: "Thanks Ada, looking into it.",
  public: true,
  attachments: [],
  audit_id: 39771900527901,
  created_at: "2026-10-08T21:25:26Z",
  ...fields,
});

export const ticketEvent = (
  ticketId: number,
  createdAt: string,
  childEvents: ReadonlyArray<unknown>,
) => ({
  id: 39771900527901,
  ticket_id: ticketId,
  timestamp: Date.parse(createdAt) / 1000,
  created_at: createdAt,
  updater_id: 39771704393373,
  via: "Web service",
  system: {},
  metadata: {},
  event_type: "Audit",
  child_events: childEvents,
});

export const group = {
  url: "https://acme.zendesk.com/api/v2/groups/39771663256989.json",
  id: 39771663256989,
  is_public: true,
  name: "Support",
  description: "",
  default: true,
  deleted: false,
  created_at: "2026-10-08T21:13:25Z",
  updated_at: "2026-10-08T21:13:25Z",
};

export const customStatus = {
  url: "https://acme.zendesk.com/api/v2/custom_statuses/39771663254173.json",
  id: 39771663254173,
  status_category: "solved",
  agent_label: "Solved",
  end_user_label: "Solved",
  active: true,
  default: true,
  created_at: "2026-10-08T21:13:25Z",
  updated_at: "2026-10-08T21:13:25Z",
};

const answer = (fields: Readonly<Record<string, unknown>>) => ({
  created_at: "2026-10-09T06:18:21.129Z",
  updated_at: "2026-10-09T06:18:21.129Z",
  ...fields,
});

export const surveyResponse = (id: string, answers: ReadonlyArray<unknown>, ticketId = "3") => ({
  id,
  expires_at: "2026-11-06T06:18:03.261Z",
  responder_id: "39771850790941",
  subject_zrns: [`zen:ticket:${ticketId}`],
  subjects: [{ id: ticketId, type: "ticket", zrn: `zen:ticket:${ticketId}` }],
  survey: { id: "01M4FMXHBW5WHJ6D7BEMA0RZC5", version: 1, state: "enabled" },
  answers,
});

export const ratingAnswer = (rating: number, category: string, updatedAt?: string) =>
  answer({
    type: "rating_scale",
    rating,
    rating_category: category,
    question: {
      type: "rating_scale_numeric",
      sub_type: "customer_satisfaction",
      id: "01M4FMXA2ZKKW0SW4G3MA6FBV9",
    },
    ...(updatedAt === undefined ? {} : { updated_at: updatedAt }),
  });

export const reasonAnswer = answer({
  type: "closed_ended",
  selections: [{ type: "predefined", option_id: "01M4FMXA30Z079V8E8P0BM67D9" }],
  question: { type: "closed_ended", id: "01M4FMXA2ZBXBT4CSMM2QAAEV7" },
});

export const commentAnswer = answer({
  type: "open_ended",
  value: "Took too long to get a reply.",
  question: { type: "open_ended", id: "01M4FMXA30EKPSYPJRYHK3NJPQ" },
});

const text = (value: string) => ({ type: "static", value });

export const csatSurvey = {
  id: "01M4FMXHBW5WHJ6D7BEMA0RZC5",
  state: "enabled",
  version: 1,
  created_at: "2026-10-09T06:16:58.492Z",
  updated_at: "2026-10-09T06:16:58.492Z",
  questions: [
    {
      type: "rating_scale_numeric",
      sub_type: "customer_satisfaction",
      id: "01M4FMXA2ZKKW0SW4G3MA6FBV9",
      headline: text("How would you rate the support you received?"),
      options: [
        { rating: 1, label: text("Very unsatisfied"), follow_up: { question_id: "x" } },
        { rating: 5, label: text("Very satisfied"), follow_up: { question_id: "y" } },
      ],
    },
    {
      type: "closed_ended",
      id: "01M4FMXA2ZBXBT4CSMM2QAAEV7",
      headline: text("Select a reason regarding your experience"),
      options: [{ id: "01M4FMXA30Z079V8E8P0BM67D9", label: text("The issue was not resolved") }],
    },
    {
      type: "open_ended",
      id: "01M4FMXA30EKPSYPJRYHK3NJPQ",
      headline: text("Share your thoughts on the support you received"),
    },
  ],
};
