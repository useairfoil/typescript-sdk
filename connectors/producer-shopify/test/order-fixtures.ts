// Trimmed from real webhooks (API 2026-07). Customer details are fake.

// #1005 after a refund with shipping. INR shop, CAD customer.
export const orderUpdatedWithCustomer = {
  id: 7097239568555,
  admin_graphql_api_id: "gid://shopify/Order/7097239568555",
  name: "#1005",
  email: "ada.testcustomer@example.com",
  phone: "+16135550177",
  customer_locale: "en",
  buyer_accepts_marketing: true,
  note: "Airfoil test order note",
  note_attributes: [],
  tags: "airfoil-test",
  confirmation_number: "UHA6U9EWQ",
  po_number: null,
  source_name: "shopify_draft_order",
  source_identifier: null,
  app_id: 1354745,
  payment_gateway_names: ["manual"],
  test: false,
  taxes_included: true,
  tax_exempt: false,
  duties_included: false,
  estimated_taxes: false,
  total_weight: 142,
  financial_status: "partially_refunded",
  cancel_reason: null,
  cancelled_at: null,
  closed_at: null,
  processed_at: "2026-09-27T17:15:56-04:00",
  created_at: "2026-09-27T17:15:56-04:00",
  updated_at: "2026-09-27T17:17:49-04:00",
  currency: "INR",
  presentment_currency: "CAD",
  discount_codes: [
    {
      code: "Airfoil test discount",
      amount: "94.78",
      type: "percentage",
    },
  ],
  discount_applications: [
    {
      target_type: "line_item",
      type: "manual",
      value: "10.0",
      value_type: "percentage",
      allocation_method: "across",
      target_selection: "all",
      title: "Airfoil test discount",
      description: "Airfoil test discount",
    },
  ],
  subtotal_price_set: {
    shop_money: {
      amount: "853.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "12.60",
      currency_code: "CAD",
    },
  },
  current_subtotal_price_set: {
    shop_money: {
      amount: "792.07",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "11.70",
      currency_code: "CAD",
    },
  },
  total_discounts_set: {
    shop_money: {
      amount: "94.78",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "1.40",
      currency_code: "CAD",
    },
  },
  current_total_discounts_set: {
    shop_money: {
      amount: "88.01",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "1.30",
      currency_code: "CAD",
    },
  },
  total_shipping_price_set: {
    shop_money: {
      amount: "60.93",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.90",
      currency_code: "CAD",
    },
  },
  current_shipping_price_set: {
    shop_money: {
      amount: "0.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.00",
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
  current_total_tax_set: {
    shop_money: {
      amount: "0.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.00",
      currency_code: "CAD",
    },
  },
  original_total_duties_set: null,
  current_total_duties_set: null,
  total_price_set: {
    shop_money: {
      amount: "913.93",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "13.50",
      currency_code: "CAD",
    },
  },
  current_total_price_set: {
    shop_money: {
      amount: "792.07",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "11.70",
      currency_code: "CAD",
    },
  },
  customer: {
    admin_graphql_api_id: "gid://shopify/Customer/9641389523115",
  },
  billing_address: {
    first_name: "Ada",
    last_name: "Testcustomer",
    name: "Ada Testcustomer",
    company: "Airfoil Test Co",
    address1: "1 Airfoil Test Street",
    address2: "Unit 7",
    city: "Ottawa",
    province: "Ontario",
    province_code: "ON",
    country: "Canada",
    country_code: "CA",
    zip: "K1A 0B1",
    phone: "+16135550143",
    latitude: 45.3648932,
    longitude: -75.62901959999999,
  },
  shipping_address: {
    first_name: "Ada",
    last_name: "Testcustomer",
    name: "Ada Testcustomer",
    company: "Airfoil Test Co",
    address1: "1 Airfoil Test Street",
    address2: "Unit 7",
    city: "Ottawa",
    province: "Ontario",
    province_code: "ON",
    country: "Canada",
    country_code: "CA",
    zip: "K1A 0B1",
    phone: "+16135550143",
    latitude: 45.3648932,
    longitude: -75.62901959999999,
  },
  tax_lines: [],
  shipping_lines: [
    {
      id: 5928667185323,
      title: "International Shipping",
      code: "International Shipping",
      source: "shopify",
      carrier_identifier: null,
      phone: null,
      is_removed: false,
      price_set: {
        shop_money: {
          amount: "60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.90",
          currency_code: "CAD",
        },
      },
      discounted_price_set: {
        shop_money: {
          amount: "60.93",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.90",
          currency_code: "CAD",
        },
      },
      current_discounted_price_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
      tax_lines: [],
      discount_allocations: [],
    },
  ],
  line_items: [
    {
      admin_graphql_api_id: "gid://shopify/LineItem/18772793327787",
      name: "Selling Plans Ski Wax - Special Selling Plans Ski Wax",
      title: "Selling Plans Ski Wax",
      variant_title: "Special Selling Plans Ski Wax",
      sku: null,
      vendor: "J Test Store",
      product_id: 8889746849963,
      variant_id: 47461171626155,
      quantity: 2,
      current_quantity: 1,
      taxable: true,
      requires_shipping: true,
      gift_card: false,
      price_set: {
        shop_money: {
          amount: "67.70",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "1.00",
          currency_code: "CAD",
        },
      },
      total_discount_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
      tax_lines: [],
      discount_allocations: [
        {
          discount_application_index: 0,
          amount_set: {
            shop_money: {
              amount: "13.54",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "0.20",
              currency_code: "CAD",
            },
          },
        },
      ],
      properties: [],
    },
    {
      admin_graphql_api_id: "gid://shopify/LineItem/18772793360555",
      name: "The Compare at Price Snowboard",
      title: "The Compare at Price Snowboard",
      variant_title: null,
      sku: null,
      vendor: "J Test Store",
      product_id: 8889746718891,
      variant_id: 47461171691691,
      quantity: 1,
      current_quantity: 1,
      taxable: true,
      requires_shipping: true,
      gift_card: false,
      price_set: {
        shop_money: {
          amount: "812.38",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "12.00",
          currency_code: "CAD",
        },
      },
      total_discount_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "CAD",
        },
      },
      tax_lines: [],
      discount_allocations: [
        {
          discount_application_index: 0,
          amount_set: {
            shop_money: {
              amount: "81.24",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "1.20",
              currency_code: "CAD",
            },
          },
        },
      ],
      properties: [],
    },
  ],
  refunds: [
    {
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
    },
  ],
} as const;

// #1001 without a customer, after a line refund and an amount-only refund.
export const orderUpdatedWithoutCustomer = {
  id: 7095411376299,
  admin_graphql_api_id: "gid://shopify/Order/7095411376299",
  name: "#1001",
  email: "",
  phone: null,
  customer_locale: "en",
  buyer_accepts_marketing: false,
  note: null,
  note_attributes: [],
  tags: "",
  confirmation_number: "8E8H8NLCZ",
  po_number: null,
  source_name: "shopify_draft_order",
  source_identifier: null,
  app_id: 1354745,
  payment_gateway_names: ["manual"],
  test: false,
  taxes_included: true,
  tax_exempt: false,
  duties_included: false,
  estimated_taxes: false,
  total_weight: 57,
  financial_status: "partially_refunded",
  cancel_reason: null,
  cancelled_at: null,
  closed_at: null,
  processed_at: "2026-09-26T18:29:05-04:00",
  created_at: "2026-09-26T18:29:06-04:00",
  updated_at: "2026-09-27T09:31:53-04:00",
  currency: "INR",
  presentment_currency: "INR",
  discount_codes: [],
  discount_applications: [],
  subtotal_price_set: {
    shop_money: {
      amount: "624.95",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "624.95",
      currency_code: "INR",
    },
  },
  current_subtotal_price_set: {
    shop_money: {
      amount: "600.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "600.00",
      currency_code: "INR",
    },
  },
  total_discounts_set: {
    shop_money: {
      amount: "0.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.00",
      currency_code: "INR",
    },
  },
  current_total_discounts_set: {
    shop_money: {
      amount: "0.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.00",
      currency_code: "INR",
    },
  },
  total_shipping_price_set: {
    shop_money: {
      amount: "0.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.00",
      currency_code: "INR",
    },
  },
  current_shipping_price_set: {
    shop_money: {
      amount: "0.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "0.00",
      currency_code: "INR",
    },
  },
  total_tax_set: {
    shop_money: {
      amount: "51.60",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "51.60",
      currency_code: "INR",
    },
  },
  current_total_tax_set: {
    shop_money: {
      amount: "49.54",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "49.54",
      currency_code: "INR",
    },
  },
  original_total_duties_set: null,
  current_total_duties_set: null,
  total_price_set: {
    shop_money: {
      amount: "624.95",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "624.95",
      currency_code: "INR",
    },
  },
  current_total_price_set: {
    shop_money: {
      amount: "600.00",
      currency_code: "INR",
    },
    presentment_money: {
      amount: "600.00",
      currency_code: "INR",
    },
  },
  customer: null,
  billing_address: null,
  shipping_address: null,
  tax_lines: [
    {
      title: "CGST",
      rate: 0.09,
      price_set: {
        shop_money: {
          amount: "51.60",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "51.60",
          currency_code: "INR",
        },
      },
    },
  ],
  shipping_lines: [],
  line_items: [
    {
      admin_graphql_api_id: "gid://shopify/LineItem/18768140042411",
      name: "Selling Plans Ski Wax - Selling Plans Ski Wax",
      title: "Selling Plans Ski Wax",
      variant_title: "Selling Plans Ski Wax",
      sku: null,
      vendor: "J Test Store",
      product_id: 8889746849963,
      variant_id: 47461171593387,
      quantity: 1,
      current_quantity: 0,
      taxable: true,
      requires_shipping: true,
      gift_card: false,
      price_set: {
        shop_money: {
          amount: "24.95",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "24.95",
          currency_code: "INR",
        },
      },
      total_discount_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "INR",
        },
      },
      tax_lines: [
        {
          title: "CGST",
          rate: 0.09,
          price_set: {
            shop_money: {
              amount: "2.06",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "2.06",
              currency_code: "INR",
            },
          },
        },
      ],
      discount_allocations: [],
      properties: [],
    },
    {
      admin_graphql_api_id: "gid://shopify/LineItem/18768140075179",
      name: "The Collection Snowboard: Hydrogen",
      title: "The Collection Snowboard: Hydrogen",
      variant_title: null,
      sku: null,
      vendor: "Hydrogen Vendor",
      product_id: 8889746817195,
      variant_id: 47461171789995,
      quantity: 1,
      current_quantity: 1,
      taxable: true,
      requires_shipping: true,
      gift_card: false,
      price_set: {
        shop_money: {
          amount: "600.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "600.00",
          currency_code: "INR",
        },
      },
      total_discount_set: {
        shop_money: {
          amount: "0.00",
          currency_code: "INR",
        },
        presentment_money: {
          amount: "0.00",
          currency_code: "INR",
        },
      },
      tax_lines: [
        {
          title: "CGST",
          rate: 0.09,
          price_set: {
            shop_money: {
              amount: "49.54",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "49.54",
              currency_code: "INR",
            },
          },
        },
      ],
      discount_allocations: [],
      properties: [],
    },
  ],
  refunds: [
    {
      id: 1024266633387,
      admin_graphql_api_id: "gid://shopify/Refund/1024266633387",
      order_id: 7095411376299,
      note: "",
      created_at: "2026-09-26T18:30:30-04:00",
      processed_at: "2026-09-26T18:30:30-04:00",
      transactions: [
        {
          admin_graphql_api_id: "gid://shopify/OrderTransaction/9237619310763",
          kind: "refund",
          status: "success",
          amount: "24.95",
          currency: "INR",
          gateway: "manual",
          test: false,
          error_code: null,
          parent_id: 9237616263339,
          created_at: "2026-09-26T18:30:30-04:00",
          processed_at: "2026-09-26T18:30:30-04:00",
        },
      ],
      refund_line_items: [
        {
          id: 687556788395,
          line_item_id: 18768140042411,
          quantity: 1,
          restock_type: "cancel",
          location_id: 88022581419,
          subtotal_set: {
            shop_money: {
              amount: "24.95",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "24.95",
              currency_code: "INR",
            },
          },
          total_tax_set: {
            shop_money: {
              amount: "2.06",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "2.06",
              currency_code: "INR",
            },
          },
        },
      ],
      order_adjustments: [],
      duties: [],
    },
    {
      id: 1024295207083,
      admin_graphql_api_id: "gid://shopify/Refund/1024295207083",
      order_id: 7095411376299,
      note: "",
      created_at: "2026-09-27T09:31:53-04:00",
      processed_at: "2026-09-27T09:31:53-04:00",
      transactions: [
        {
          admin_graphql_api_id: "gid://shopify/OrderTransaction/9239327703211",
          kind: "refund",
          status: "success",
          amount: "100.00",
          currency: "INR",
          gateway: "manual",
          test: false,
          error_code: null,
          parent_id: 9237616263339,
          created_at: "2026-09-27T09:31:53-04:00",
          processed_at: "2026-09-27T09:31:53-04:00",
        },
      ],
      refund_line_items: [],
      order_adjustments: [
        {
          id: 428482822315,
          kind: "refund_discrepancy",
          reason: "Refund discrepancy",
          amount_set: {
            shop_money: {
              amount: "-100.00",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "-100.00",
              currency_code: "INR",
            },
          },
          tax_amount_set: {
            shop_money: {
              amount: "0.00",
              currency_code: "INR",
            },
            presentment_money: {
              amount: "0.00",
              currency_code: "INR",
            },
          },
        },
      ],
      duties: [],
    },
  ],
} as const;
