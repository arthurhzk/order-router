import { addLine, cleanCountry, cleanSku, cleanZip, findBundle } from "./cleanData";
import { Catalog, Order, OrderCreatedEvent, OrderEditedEvent, OrderEvent, OrderLine } from "./types";

const EDIT_WINDOW_IN_MINUTES = 30;

export function buildOrders(events: OrderEvent[], catalog: Catalog): Order[] {
  const orders: Order[] = [];

  for (const event of events) {
    if (event.type === "order_created") {
      orders.push(createOrder(event));
    }
  }

  for (const event of events) {
    if (event.type === "order_edited") {
      applyEdit(event, orders);
    }
  }

  for (const order of orders) {
    order.lines = prepareLines(order.lines, catalog, order.notes);
  }

  orders.sort((firstOrder, secondOrder) => firstOrder.createdAt.getTime() - secondOrder.createdAt.getTime());

  return orders;
}

function createOrder(event: OrderCreatedEvent): Order {
  const notes: string[] = [];
  const rawZip = event.shipTo.zip;
  const zip = cleanZip(rawZip);

  if (typeof rawZip === "number") {
    notes.push(`zip came as number ${rawZip}, fixed to ${zip}`);
  }

  if (typeof rawZip === "string" && zip !== null && rawZip.trim() !== zip) {
    notes.push(`zip "${rawZip}" reduced to ${zip}`);
  }

  return {
    orderNumber: event.orderNumber,
    createdAt: new Date(event.at),
    country: cleanCountry(event.shipTo.country),
    zip: zip,
    lines: [...event.lines],
    notes: notes,
  };
}

function applyEdit(edit: OrderEditedEvent, orders: Order[]): void {
  const order = findOrder(orders, edit.orderNumber);

  if (order === undefined) {
    console.warn(`edit for unknown order ${edit.orderNumber} ignored`);
    return;
  }

  const minutesAfterCreation = (new Date(edit.at).getTime() - order.createdAt.getTime()) / 60000;

  if (minutesAfterCreation < 0 || minutesAfterCreation > EDIT_WINDOW_IN_MINUTES) {
    order.notes.push(`edit at ${edit.at} ignored, outside the 30 minute window`);
    return;
  }

  for (const addedLine of edit.addedLines) {
    order.lines.push(addedLine);
    order.notes.push(`edit added ${addedLine.quantity}x ${addedLine.sku}`);
  }
}

function findOrder(orders: Order[], orderNumber: string): Order | undefined {
  for (const order of orders) {
    if (order.orderNumber === orderNumber) {
      return order;
    }
  }

  return undefined;
}

function prepareLines(rawLines: OrderLine[], catalog: Catalog, notes: string[]): OrderLine[] {
  const preparedLines: OrderLine[] = [];

  for (const rawLine of rawLines) {
    const sku = cleanSku(rawLine.sku);

    if (sku !== rawLine.sku) {
      notes.push(`sku "${rawLine.sku}" fixed to ${sku}`);
    }

    if (rawLine.quantity <= 0) {
      notes.push(`line ${sku} ignored, invalid quantity ${rawLine.quantity}`);
      continue;
    }

    const bundle = findBundle(catalog, sku);

    if (bundle === undefined) {
      addLine(preparedLines, sku, rawLine.quantity);
      continue;
    }

    notes.push(`bundle ${sku} split into its products`);

    for (const component of bundle.components) {
      addLine(preparedLines, component.sku, component.quantity * rawLine.quantity);
    }
  }

  return preparedLines;
}
