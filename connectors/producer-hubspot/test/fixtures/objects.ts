// Shapes from the 2026-09 API, with test data.

export const portalId = 247620162;

export const properties = {
  results: [
    { name: "email" },
    { name: "firstname" },
    { name: "phone" },
    { name: "lastmodifieddate" },
    { name: "hs_merged_object_ids" },
  ],
};

export const crmObject = (
  id: string,
  values: Readonly<Record<string, string | null>> = {},
  times: { readonly createdAt?: string; readonly updatedAt?: string } = {},
) => ({
  id,
  properties: { hs_object_id: id, ...values },
  createdAt: times.createdAt ?? "2026-10-06T20:05:18.410Z",
  updatedAt: times.updatedAt ?? "2026-10-06T20:05:54.562Z",
  archived: false,
  url: `https://app-na2.hubspot.com/contacts/${portalId}/record/0-1/${id}`,
});

export const ada = crmObject("101", {
  email: "ada@acme.example.com",
  firstname: "Ada",
  phone: null,
  hs_merged_object_ids: null,
});

/** The record two contacts were merged into. */
export const merged = crmObject("103", {
  email: "merge-a@acme.example.com",
  firstname: "Merge",
  hs_merged_object_ids: "201;202",
});

export const archivedCompany = (id: string, archivedAt: string) => ({
  ...crmObject(id, { name: "Delete Me Co" }),
  archived: true,
  archivedAt,
});

export const owner = {
  id: "100568476",
  email: "owner@example.com",
  type: "PERSON",
  firstName: "Jo",
  lastName: "Owner",
  userId: 100568476,
  userIdIncludingInactive: 100568476,
  createdAt: "2026-10-06T19:39:58.678Z",
  updatedAt: "2026-10-06T19:40:00.408Z",
  archived: false,
};

export const removedOwner = {
  id: "100568477",
  type: "PERSON",
  userIdIncludingInactive: 100568477,
  createdAt: "2026-10-06T19:39:58.678Z",
  updatedAt: "2026-10-07T08:00:00.000Z",
  archived: true,
  teams: [{ id: "55", name: "Sales", primary: true }],
};

export const pipeline = (id: string, stage: Readonly<Record<string, string>>) => ({
  label: "Sales Pipeline",
  displayOrder: 0,
  id,
  stages: [
    {
      label: "Appointment Scheduled",
      displayOrder: 0,
      metadata: stage,
      id: "appointmentscheduled",
      createdAt: "1970-01-01T00:00:00Z",
      updatedAt: "1970-01-01T00:00:00Z",
      writePermissions: "CRM_PERMISSIONS_ENFORCEMENT",
      archived: false,
    },
  ],
  createdAt: "1970-01-01T00:00:00Z",
  updatedAt: "1970-01-01T00:00:00Z",
  archived: false,
});
