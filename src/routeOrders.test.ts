import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrders } from "./buildOrders";
import { cleanZip } from "./cleanData";
import { routeOrders } from "./routeOrders";
import { Catalog, OrderEvent, Warehouse, Zones } from "./types";

const catalog: Catalog = {
  products: [
    { sku: "A", name: "Product A" },
    { sku: "B", name: "Product B" },
  ],
  bundles: [
    { sku: "BUNDLE", name: "Bundle", components: [{ sku: "A", quantity: 1 }, { sku: "B", quantity: 1 }] },
  ],
};

const zones: Zones = {
  "WH-NJ": { "070": 1, "303": 5 },
  "WH-GA": { "070": 5, "303": 1 },
};

function createWarehouses(): Warehouse[] {
  return [
    {
      code: "WH-NJ",
      city: "Edison",
      enabled: true,
      inventory: { A: { available: 10, dailyVelocity: 10 }, B: { available: 1, dailyVelocity: 10 } },
    },
    {
      code: "WH-GA",
      city: "Atlanta",
      enabled: true,
      inventory: { A: { available: 10, dailyVelocity: 1 }, B: { available: 10, dailyVelocity: 1 } },
    },
  ];
}

function createOrderEvent(orderNumber: string, at: string, zip: string, sku: string, quantity: number): OrderEvent {
  return {
    type: "order_created",
    orderNumber: orderNumber,
    at: at,
    shipTo: { country: "US", zip: zip },
    lines: [{ sku: sku, quantity: quantity }],
  };
}

test("zip that lost its leading zero is fixed", () => {
  assert.equal(cleanZip(2134), "02134");
  assert.equal(cleanZip("07030-1834"), "07030");
  assert.equal(cleanZip(""), null);
  assert.equal(cleanZip("M5V 2T6"), null);
});

test("second order goes to the other warehouse after stock is reserved", () => {
  const events = [
    createOrderEvent("#1", "2026-10-20T13:00:00.000Z", "07030", "B", 1),
    createOrderEvent("#2", "2026-10-20T13:01:00.000Z", "07030", "B", 1),
  ];

  const orders = buildOrders(events, catalog);
  const results = routeOrders(orders, createWarehouses(), zones, []);

  assert.equal(results[0].destination, "WH-NJ");
  assert.equal(results[1].destination, "WH-GA");
});

test("edit inside 30 minutes is routed together with the order", () => {
  const events: OrderEvent[] = [
    createOrderEvent("#1", "2026-10-20T13:00:00.000Z", "07030", "A", 1),
    { type: "order_edited", orderNumber: "#1", at: "2026-10-20T13:20:00.000Z", addedLines: [{ sku: "B", quantity: 2 }] },
  ];

  const orders = buildOrders(events, catalog);
  const results = routeOrders(orders, createWarehouses(), zones, []);

  assert.equal(results[0].destination, "WH-GA");
});

test("edit after 30 minutes is ignored", () => {
  const events: OrderEvent[] = [
    createOrderEvent("#1", "2026-10-20T13:00:00.000Z", "07030", "A", 1),
    { type: "order_edited", orderNumber: "#1", at: "2026-10-20T13:31:00.000Z", addedLines: [{ sku: "B", quantity: 2 }] },
  ];

  const orders = buildOrders(events, catalog);

  assert.equal(orders[0].lines.length, 1);
});

test("bundle is split into products and lowercase sku is fixed", () => {
  const events = [createOrderEvent("#1", "2026-10-20T13:00:00.000Z", "30303", "bundle", 2)];

  const orders = buildOrders(events, catalog);

  assert.deepEqual(orders[0].lines, [
    { sku: "A", quantity: 2 },
    { sku: "B", quantity: 2 },
  ]);
});

test("warehouse forced off is skipped", () => {
  const events = [createOrderEvent("#1", "2026-10-20T13:00:00.000Z", "07030", "A", 1)];

  const orders = buildOrders(events, catalog);
  const results = routeOrders(orders, createWarehouses(), zones, ["WH-NJ"]);

  assert.equal(results[0].destination, "WH-GA");
});
