import { Schema } from "effect";

import { Long, LongFromString, Timestamp, field, list } from "./shared";

const AnswerSchema = Schema.Struct({
  question_id: Schema.String.pipe(field(102, "Question ID in the survey.")),
  question_type: Schema.String.pipe(
    field(103, "Question type, such as rating_scale_numeric or open_ended."),
  ),
  type: Schema.String.pipe(
    field(104, "Answer type: rating_scale, closed_ended, open_ended, or skipped."),
  ),
  rating: Schema.NullOr(Long).pipe(field(105, "Rating picked, for a rating question.")),
  rating_category: Schema.NullOr(Schema.String).pipe(
    field(106, "bad, neutral, or good, for a rating question."),
  ),
  value: Schema.NullOr(Schema.String).pipe(field(107, "Text written, for an open question.")),
  option_ids: list(108, Schema.String).pipe(field(109, "Options picked, for a choice question.")),
  updated_at: Timestamp.pipe(field(110, "Time the answer was last changed.")),
});

export const SurveyResponseSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Survey response ID.")),
  version: Schema.Date.pipe(field(2, "Time the latest answer was changed.")),
  ticket_id: Schema.NullOr(Long).pipe(field(3, "Ticket the survey was about.")),
  responder_id: Long.pipe(field(4, "User who answered.")),
  survey_id: Schema.String.pipe(field(5, "Survey ID.")),
  survey_version: Long.pipe(field(6, "Survey version answered.")),
  rating: Schema.NullOr(Long).pipe(field(7, "Customer satisfaction rating, such as 1 to 5.")),
  rating_category: Schema.NullOr(Schema.String).pipe(
    field(8, "Customer satisfaction category: bad, neutral, or good."),
  ),
  answers: list(101, AnswerSchema).pipe(field(9, "Every answer in the response.")),
  expires_at: Timestamp.pipe(field(10, "Time after which the answers can't change.")),
}).annotate({ description: "Answers to Zendesk CSAT surveys. Unanswered surveys are left out." });

export type SurveyResponse = Schema.Schema.Type<typeof SurveyResponseSchema>;

export const SurveyResponseObjectSchema = Schema.Struct({
  id: Schema.String,
  expires_at: Timestamp,
  responder_id: LongFromString,
  subjects: Schema.Array(Schema.Struct({ id: Schema.String, type: Schema.String })),
  survey: Schema.Struct({ id: Schema.String, version: Long }),
  answers: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      question: Schema.Struct({
        id: Schema.String,
        type: Schema.String,
        sub_type: Schema.optional(Schema.String),
      }),
      rating: Schema.optional(Long),
      rating_category: Schema.optional(Schema.String),
      value: Schema.optional(Schema.String),
      selections: Schema.optional(Schema.Array(Schema.Struct({ option_id: Schema.String }))),
      updated_at: Timestamp,
    }),
  ),
});

export type SurveyResponseObject = Schema.Schema.Type<typeof SurveyResponseObjectSchema>;

const Text = Schema.Struct({ value: Schema.String });

export const CsatSurveySchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "Survey ID.")),
  version: Schema.Date.pipe(field(2, "Time Zendesk last updated the survey.")),
  survey_version: Long.pipe(field(3, "Current survey version.")),
  state: Schema.String.pipe(field(4, "enabled or disabled.")),
  created_at: Timestamp.pipe(field(5, "Time the survey was created.")),
  updated_at: Timestamp.pipe(field(6, "Time the survey was last updated.")),
  questions: list(
    101,
    Schema.Struct({
      id: Schema.String.pipe(field(102, "Question ID, as in `survey_responses.answers`.")),
      type: Schema.String.pipe(field(103, "Question type.")),
      sub_type: Schema.NullOr(Schema.String).pipe(
        field(104, "customer_satisfaction for the main rating question."),
      ),
      headline: Schema.String.pipe(field(105, "Question text.")),
      options: list(
        106,
        Schema.Struct({
          id: Schema.NullOr(Schema.String).pipe(field(107, "Option ID, for a choice question.")),
          rating: Schema.NullOr(Long).pipe(field(108, "Rating, for a rating question.")),
          label: Schema.String.pipe(field(109, "Option text. Can be empty.")),
        }),
      ).pipe(field(110, "Options of the question.")),
    }),
  ).pipe(field(7, "Questions in the current version.")),
}).annotate({ description: "Zendesk CSAT surveys. Names the IDs in `survey_responses`." });

export type CsatSurvey = Schema.Schema.Type<typeof CsatSurveySchema>;

export const CsatSurveyObjectSchema = Schema.Struct({
  id: Schema.String,
  version: Long,
  state: Schema.String,
  created_at: Timestamp,
  updated_at: Timestamp,
  questions: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      type: Schema.String,
      sub_type: Schema.optional(Schema.String),
      headline: Text,
      options: Schema.optional(
        Schema.Array(
          Schema.Struct({
            id: Schema.optional(Schema.String),
            rating: Schema.optional(Long),
            label: Text,
          }),
        ),
      ),
    }),
  ),
});

export type CsatSurveyObject = Schema.Schema.Type<typeof CsatSurveyObjectSchema>;
