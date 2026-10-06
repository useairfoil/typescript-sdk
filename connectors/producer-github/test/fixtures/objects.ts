// Trimmed from real API and webhook payloads. Fields the connector ignores,
// such as `url` and `assignee`, are kept to show they are dropped.

export const user = {
  login: "octocat",
  id: 583231,
  node_id: "U_kgDODYHTeQ",
  type: "User",
  site_admin: false,
};

export const repository = {
  id: 1406396726,
  node_id: "R_kgDOU9PpNg",
  name: "hello-world",
  full_name: "octocat/hello-world",
  owner: user,
  private: true,
  html_url: "https://github.com/octocat/hello-world",
  description: null,
  fork: false,
  url: "https://api.github.com/repos/octocat/hello-world",
  created_at: "2026-10-05T21:26:32Z",
  updated_at: "2026-10-05T21:26:33Z",
  pushed_at: "2026-10-05T21:43:15Z",
  stargazers_count: 0,
  language: null,
  archived: false,
  disabled: false,
  topics: [],
  visibility: "private",
  default_branch: "main",
  has_issues: true,
  has_pull_requests: true,
};

export const otherRepository = {
  ...repository,
  id: 1406425446,
  node_id: "R_kgDOU9RZZg",
  name: "spoon-knife",
  full_name: "octocat/spoon-knife",
  html_url: "https://github.com/octocat/spoon-knife",
  url: "https://api.github.com/repos/octocat/spoon-knife",
};

export const issue = {
  url: "https://api.github.com/repos/octocat/hello-world/issues/1",
  html_url: "https://github.com/octocat/hello-world/issues/1",
  id: 5719289302,
  node_id: "I_kwDOU9PpNs8AAAABVOVt1g",
  number: 1,
  title: "Live check A",
  user,
  labels: [
    {
      id: 12557819502,
      node_id: "LA_kwDOU9PpNs8AAAAC7IEebg",
      name: "bug",
      color: "d73a4a",
      default: true,
      description: "Something isn't working",
    },
  ],
  state: "open",
  locked: false,
  assignee: user,
  assignees: [user],
  milestone: null,
  comments: 0,
  created_at: "2026-10-05T21:40:30Z",
  updated_at: "2026-10-05T22:04:14Z",
  closed_at: null,
  author_association: "OWNER",
  body: null,
  state_reason: null,
};

/** How the issues list returns a pull request. */
export const pullRequestIssue = {
  ...issue,
  id: 5719300000,
  number: 3,
  labels: [],
  assignees: [],
  pull_request: { url: "https://api.github.com/repos/octocat/hello-world/pulls/3" },
};

export const pullRequest = {
  url: "https://api.github.com/repos/octocat/hello-world/pulls/3",
  id: 4751110848,
  node_id: "PR_kwDOU9PpNs8AAAABGzAywA",
  html_url: "https://github.com/octocat/hello-world/pull/3",
  number: 3,
  state: "closed",
  locked: false,
  title: "Update README.md",
  user,
  body: null,
  created_at: "2026-10-05T21:43:17Z",
  updated_at: "2026-10-05T22:05:25Z",
  closed_at: "2026-10-05T22:05:25Z",
  merged_at: null,
  assignee: null,
  assignees: [],
  requested_reviewers: [],
  labels: [],
  milestone: null,
  draft: false,
  head: {
    label: "octocat:octocat-patch-1",
    ref: "octocat-patch-1",
    sha: "9eb3a7d2ad61c47a7ee47c07e9787a616d0a228f",
  },
  base: {
    label: "octocat:main",
    ref: "main",
    sha: "351503f0426ffd1478bf966741fd57856a1422e0",
  },
  author_association: "OWNER",
};

export const issueComment = {
  url: "https://api.github.com/repos/octocat/hello-world/issues/comments/6003550342",
  html_url: "https://github.com/octocat/hello-world/issues/2#issuecomment-6003550342",
  issue_url: "https://api.github.com/repos/octocat/hello-world/issues/2",
  id: 6003550342,
  node_id: "IC_kwDOU9PpNs8AAAABZdbohg",
  user,
  created_at: "2026-10-05T21:40:52Z",
  updated_at: "2026-10-05T22:04:52Z",
  author_association: "OWNER",
  body: "First live check comment",
};

export const installationId = 168295910;

/** A webhook payload for the test installation and repository. */
export const event = (action: string, fields: Readonly<Record<string, unknown>>) => ({
  action,
  ...fields,
  repository: fields.repository ?? repository,
  sender: user,
  installation: { id: installationId, node_id: "MDIzOkludGVncmF0aW9uSW5zdGFsbGF0aW9uMTY4Mjk1OTEw" },
});
