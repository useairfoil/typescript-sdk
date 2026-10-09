import { Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, Option } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  type CsatSurvey,
  type CsatSurveyObject,
  CsatSurveyObjectSchema,
  CsatSurveySchema,
  type SurveyResponse,
  type SurveyResponseObject,
  SurveyResponseObjectSchema,
  SurveyResponseSchema,
} from "../schemas/csat";
import { hourly, listAll, listSources, readPage } from "./pages";

const list = {
  path: "/guide/survey_responses",
  key: "survey_responses",
  item: SurveyResponseObjectSchema,
  // This list allows at most 50 a page.
  params: { "page[size]": "50", sort: "id" },
};
// Answers can change for 28 days; the list only filters by when surveys were sent.
const editableWindow = Duration.days(29);
// Allow for clock drift.
const overlap = Duration.minutes(10);

// Unanswered surveys have no answer time to use as a version.
const toRow = (response: SurveyResponseObject): ReadonlyArray<SurveyResponse> => {
  const { answers } = response;
  if (answers.length === 0) return [];
  const csat = answers.find((answer) => answer.question.sub_type === "customer_satisfaction");
  // A messaging survey is about a conversation, not a ticket.
  const ticket = response.subjects.find((subject) => subject.type === "ticket");
  return [
    {
      id: response.id,
      version: new Date(Math.max(...answers.map((answer) => answer.updated_at.getTime()))),
      ticket_id: ticket === undefined ? null : BigInt(ticket.id),
      responder_id: response.responder_id,
      survey_id: response.survey.id,
      survey_version: response.survey.version,
      rating: csat?.rating ?? null,
      rating_category: csat?.rating_category ?? null,
      answers: answers.map((answer) => ({
        question_id: answer.question.id,
        question_type: answer.question.type,
        type: answer.type,
        rating: answer.rating ?? null,
        rating_category: answer.rating_category ?? null,
        value: answer.value ?? null,
        option_ids: (answer.selections ?? []).map((selection) => selection.option_id),
        updated_at: answer.updated_at,
      })),
      expires_at: response.expires_at,
    },
  ];
};

export const makeSurveyResponses = (client: ZendeskClientService) =>
  Resource.entity({
    name: "survey_responses",
    rowSchema: SurveyResponseSchema,
    key: "id",
    version: "version",

    check: readPage(client, { ...list, params: { "page[size]": "1" } }).pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor }) =>
        readPage(client, list, Option.fromNullishOr(pageCursor).pipe(Option.map(String))).pipe(
          Effect.map(({ items, next }) =>
            Option.match(next, {
              onNone: () => ({ rows: items.flatMap(toRow), hasMore: false }),
              onSome: (cursor) => ({
                rows: items.flatMap(toRow),
                hasMore: true,
                nextPageCursor: cursor,
              }),
            }),
          ),
        ),
    }),
    changes: Fetch.changes({
      cursor: Cursor.isoDateTime(),
      interval: hourly,
      fetch: ({ cursor }) =>
        Effect.gen(function* () {
          const now = yield* DateTime.now;
          const lastRun = DateTime.makeUnsafe(String(cursor));
          const changedAfter = DateTime.subtractDuration(lastRun, overlap);
          const responses = yield* listAll(client, {
            ...list,
            params: {
              ...list.params,
              "filter[created_at_start]": String(
                DateTime.toEpochMillis(DateTime.subtractDuration(lastRun, editableWindow)),
              ),
            },
          });
          return {
            rows: responses
              .flatMap(toRow)
              .filter((row) => row.version.getTime() > DateTime.toEpochMillis(changedAfter)),
            cursor: DateTime.formatIso(now),
          };
        }),
    }),
  });

const toSurveyRow = ({ version, questions, ...survey }: CsatSurveyObject): CsatSurvey => ({
  ...survey,
  version: survey.updated_at,
  survey_version: version,
  questions: questions.map((question) => ({
    id: question.id,
    type: question.type,
    sub_type: question.sub_type ?? null,
    headline: question.headline.value,
    options: (question.options ?? []).map((option) => ({
      id: option.id ?? null,
      rating: option.rating ?? null,
      label: option.label.value,
    })),
  })),
});

export const makeCsatSurveys = (client: ZendeskClientService) =>
  Resource.entity({
    name: "csat_surveys",
    rowSchema: CsatSurveySchema,
    key: "id",
    version: "version",
    ...listSources(
      // Labels come in this locale when they are dynamic content.
      listAll(client, {
        path: "/guide/en-us/surveys",
        key: "surveys",
        item: CsatSurveyObjectSchema,
        params: { "page[size]": "50" },
      }).pipe(Effect.map((surveys) => surveys.map(toSurveyRow))),
    ),
  });
