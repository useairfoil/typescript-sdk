// Trimmed from real webhooks (API 2026-07). Customer details are fake.

// #1005, refunded to the manual gateway with shipping and a note.
export const refundWithShipping = {
  id: 1024319488171,
  admin_graphql_api_id: "gid://shopify/Refund/1024319488171",
  order_id: 7097239568555,
  note: "Airfoil test refund note",
  created_at: "2026-09-27T17:17:49-04:00",
  processed_at: "2026-09-27T17:17:49-04:00",
  transactions: [
    {
      admin_graphql_api_id: "gid://shopify/OrderTransaction/9240474747051",
      kind: "refund",
      status: "success",
      amount: "1.80",
      currency: "CAD",
      gateway: "manual",
      test: false,
      error_code: null,
      parent_id: 9240470061227,
      created_at: "2026-09-27T17:17:49-04:00",
      processed_at: "2026-09-27T17:17:49-04:00",
    },
  ],
  refund_line_items: [
    {
      id: 687643918507,
      line_item_id: 18772793327787,
      quantity: 1,
      restock_type: "cancel",
      location_id: 88022581419,
      subtotal_set: {
        shop_money: {
          amount: "60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.90",
          currency_code: "CAD",
        },
      },
      total_tax_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
    },
  ],
  refund_shipping_lines: [
    {
      id: 54026469547,
      shipping_line_id: 5928667185323,
      subtotal_amount_set: {
        shop_money: {
          amount: "60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.90",
          currency_code: "CAD",
        },
      },
    },
  ],
  order_adjustments: [
    {
      id: 428506120363,
      kind: "shipping_refund",
      reason: "Shipping refund",
      amount_set: {
        shop_money: {
          amount: "-60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "-0.90",
          currency_code: "CAD",
        },
      },
      tax_amount_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
    },
  ],
  duties: [],
} as const;

// #1003, refunded to store credit.
export const refundToStoreCredit = {
  id: 1024295501995,
  admin_graphql_api_id: "gid://shopify/Refund/1024295501995",
  order_id: 7096515068075,
  note: "",
  created_at: "2026-09-27T09:34:29-04:00",
  processed_at: "2026-09-27T09:34:29-04:00",
  transactions: [
    {
      admin_graphql_api_id: "gid://shopify/OrderTransaction/9239333175467",
      kind: "refund",
      status: "success",
      amount: "15.00",
      currency: "CAD",
      gateway: "shopify_store_credit",
      test: false,
      error_code: null,
      parent_id: null,
      created_at: "2026-09-27T09:34:29-04:00",
      processed_at: "2026-09-27T09:34:29-04:00",
    },
  ],
  refund_line_items: [
    {
      id: 687606169771,
      line_item_id: 18771263520939,
      quantity: 1,
      restock_type: "cancel",
      location_id: 88022581419,
      subtotal_set: {
        shop_money: {
          amount: "1015.47",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "15.00",
          currency_code: "CAD",
        },
      },
      total_tax_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
    },
  ],
  refund_shipping_lines: [],
  order_adjustments: [],
  duties: [],
} as const;

// #1004, refunded through the test gateway.
export const refundThroughGateway = {
  id: 1024296812715,
  admin_graphql_api_id: "gid://shopify/Refund/1024296812715",
  order_id: 7096534532267,
  note: "",
  created_at: "2026-09-27T09:50:46-04:00",
  processed_at: "2026-09-27T09:50:46-04:00",
  transactions: [
    {
      admin_graphql_api_id: "gid://shopify/OrderTransaction/9239366009003",
      kind: "refund",
      status: "success",
      amount: "11.90",
      currency: "CAD",
      gateway: "bogus",
      test: true,
      error_code: null,
      parent_id: 9239363518635,
      created_at: "2026-09-27T09:50:46-04:00",
      processed_at: "2026-09-27T09:50:46-04:00",
    },
  ],
  refund_line_items: [
    {
      id: 687609675947,
      line_item_id: 18771302416555,
      quantity: 1,
      restock_type: "cancel",
      location_id: 88022581419,
      subtotal_set: {
        shop_money: {
          amount: "744.68",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "11.00",
          currency_code: "CAD",
        },
      },
      total_tax_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
    },
  ],
  refund_shipping_lines: [
    {
      id: 54023323819,
      shipping_line_id: 5928071757995,
      subtotal_amount_set: {
        shop_money: {
          amount: "60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.90",
          currency_code: "CAD",
        },
      },
    },
  ],
  order_adjustments: [
    {
      id: 428484231339,
      kind: "shipping_refund",
      reason: "Shipping refund",
      amount_set: {
        shop_money: {
          amount: "-60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "-0.90",
          currency_code: "CAD",
        },
      },
      tax_amount_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
    },
  ],
  duties: [],
} as const;

// #1005, a manual refund with a DAMAGE reason. Read from the REST refund, which has the
// same shape as the refunds/create webhook.
export const refundWithDamageAdjustment = {
  id: 1024460292267,
  admin_graphql_api_id: "gid://shopify/Refund/1024460292267",
  order_id: 7097239568555,
  note: "Airfoil reason capture DAMAGE",
  created_at: "2026-09-28T17:18:24-04:00",
  processed_at: "2026-09-28T17:18:24-04:00",
  transactions: [
    {
      admin_graphql_api_id: "gid://shopify/OrderTransaction/9243875639467",
      kind: "refund",
      status: "success",
      amount: "0.50",
      currency: "CAD",
      gateway: "manual",
      test: false,
      error_code: null,
      parent_id: 9240470061227,
      created_at: "2026-09-28T17:18:24-04:00",
      processed_at: "2026-09-28T17:18:24-04:00",
    },
  ],
  refund_line_items: [],
  refund_shipping_lines: [],
  order_adjustments: [
    {
      id: 428630900907,
      kind: "refund_discrepancy",
      reason: "damage",
      amount_set: {
        shop_money: { amount: "-33.84", currency_code: "INR" },
        presentment_money: { amount: "-0.50", currency_code: "CAD" },
      },
      tax_amount_set: {
        shop_money: { amount: "0.00", currency_code: "INR" },
        presentment_money: { amount: "0.00", currency_code: "CAD" },
      },
    },
  ],
  duties: [],
};
