/** Connector-specific runtime keys injected by the Airfoil platform. */
export const PolarRuntimeKey = {
  webhookPort: "POLAR_WEBHOOK_PORT",
  customersTable: "POLAR_CUSTOMERS_TABLE",
  checkoutsTable: "POLAR_CHECKOUTS_TABLE",
  ordersTable: "POLAR_ORDERS_TABLE",
  subscriptionsTable: "POLAR_SUBSCRIPTIONS_TABLE",
} as const;
