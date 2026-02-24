# producer-polar

A demo connector that streams Polar data (customers, checkouts, orders, subscriptions) into Airfoil via webhooks and backfill.

---

## Prerequisites

- [Bun](https://bun.sh) installed
- A [Polar sandbox account](https://sandbox.polar.sh) (free, completely isolated from production)
- A tunnel to expose your local server — [ngrok](https://ngrok.com), [Tailscale Funnel](https://tailscale.com/kb/1223/funnel), or similar

---

## Step 1 — Create a Polar sandbox account

Go to [sandbox.polar.sh](https://sandbox.polar.sh) and sign up. Create an organization if you don't have one — you'll need the organization ID later (visible in the URL or in **Settings → General**).

---

## Step 2 — Create a product

In the sidebar go to **Products → Catalogue → New Product**.

- Give it a name (e.g. `Test`)
- Set a price (e.g. `$10` one-time)
- Hit **Create**

---

## Step 3 — Get an Organization Access Token

Go to **Settings → API** and create a new Organization Access Token (OAT).

- Give it a name
- Grant the scopes you need — for this demo, full access is fine
- Copy the token immediately, it won't be shown again

This goes in `POLAR_ACCESS_TOKEN`. See [Polar OAT docs](https://polar.sh/integrate/oat) if you need help locating the page.

---

## Step 4 — Start a tunnel

Start your tunnel pointing at port `8080`:

```bash
# ngrok
ngrok http 8080

# Tailscale Funnel
tailscale funnel 8080
```

Copy the public HTTPS URL (e.g. `https://abc123.ngrok.io` or `https://your-machine.ts.net`). You'll use it in the next step.

---

## Step 5 — Set up a webhook endpoint

In Polar, go to **Settings → Webhooks → Add Endpoint**.

- **URL**: `<your-tunnel-url>/webhooks/polar`
- **Format**: Raw
- **Secret**: any random string — copy it for `POLAR_WEBHOOK_SECRET`

Enable the following events:

- `checkout.created`, `checkout.updated`, `checkout.expired`
- `customer.created`, `customer.updated`, `customer.deleted`
- `order.created`, `order.updated`, `order.paid`, `order.refunded`
- `subscription.created`, `subscription.updated`, `subscription.active`, `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`, `subscription.past_due`

Save the endpoint.

---

## Step 6 — Configure environment variables

```bash
cp .env.example .env
```

Fill in the values:

```env
# From Step 3
POLAR_ACCESS_TOKEN=polar_oat_XX

# Your organization ID (from Settings → General or the URL)
POLAR_ORGANIZATION_ID=512929b6-XX

# The secret you set in Step 5
POLAR_WEBHOOK_SECRET=polar_whs_XXX

# Port for the local webhook server (must match your tunnel, default 8080)
POLAR_WEBHOOK_PORT=8080
```

---

## Step 7 — Run the sandbox

From the repo root:

```bash
bun run --cwd connectors/producer-polar sandbox
```

Or from inside the connector directory:

```bash
cd connectors/producer-polar
bun run sandbox
```

You should see:

```
timestamp=... level=INFO fiber=#1 message="Listening on http://localhost:8080"
[polar] webhook server ready { port: 8080, routes: [ '/webhooks/polar' ] }
```

---

## Step 8 — Place a test order

Go to **Products → Checkout Links**. Open an existing link or create a new one pointed at your test product, then copy the checkout URL and open it in a browser.

Fill in any email, use the Stripe test card (`4242 4242 4242 4242`, any future expiry, any CVC), and complete the checkout.

You'll immediately see logs as events arrive:

```
[polar] webhook checkout.created { id: 'c8a3c899', status: 'open' }
[polar] publish checkouts { count: 1, ids: [ 'c8a3c899' ], cursor: '...' }
[polar] webhook checkout.updated { id: 'c8a3c899', status: 'confirmed' }
[polar] publish checkouts { count: 1, ids: [ 'c8a3c899' ], cursor: '...' }
[polar] webhook customer.created { id: 'b0f0b111', email: 'test@example.com' }
[polar] publish customers { count: 1, ids: [ 'b0f0b111' ], cursor: '...' }
[polar] webhook order.created { id: '5ab8cd53', status: 'paid', paid: true }
[polar] publish orders { count: 1, ids: [ '5ab8cd53' ], cursor: '...' }
[polar] webhook order.paid { id: '5ab8cd53', status: 'paid', paid: true }
[polar] publish orders { count: 1, ids: [ '5ab8cd53' ], cursor: '...' }
```

Each line shows the incoming event (`[polar] webhook ...`) followed by what got published to Airfoil (`[polar] publish ...`). Multiple events for the same entity are expected — Polar fires lifecycle events as the order moves through states.

---

## How it works

```
Polar ──webhook──▶ /webhooks/polar ──▶ resolveWebhookDispatch ──▶ entity queues
                                                                        │
                                                              ┌─────────┴──────────┐
                                                              │  backfill stream   │  ← fetches historical pages
                                                              │  live stream       │  ← webhook events
                                                              └─────────┬──────────┘
                                                                        │
                                                                   Publisher
                                                              (ConsolePublisher in sandbox,
                                                               WingsPublisher in production)
```

The first live webhook event for each entity sets the **cutoff**. The backfill then fetches all historical records up to that point so nothing is duplicated between live and historical data.

---

## Project structure

```
src/
├── schemas.ts    — entity schemas (Customer, Checkout, Order, Subscription) and webhook event union
├── api.ts        — Polar HTTP client (fetchJson, fetchList)
├── streams.ts    — stream helpers (backfill paging, live queue, cursor logic)
├── index.ts      — connector factory (makePolarConnector) and webhook verification
└── sandbox.ts    — demo runner with console publisher
```
