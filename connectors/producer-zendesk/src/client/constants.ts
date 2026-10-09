export const baseUrl = (subdomain: string) =>
  `https://${subdomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.zendesk\.com$/i, "")}.zendesk.com`;
