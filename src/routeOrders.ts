import { Order, RouteResult, Warehouse, Zones } from "./types";

const TIE_BREAK_PRIORITY = ["WH-NJ", "WH-GA", "WH-NV", "WH-TX"];

type WarehouseOption = {
  warehouse: Warehouse;
  zone: number;
  daysOfCover: number;
};

export function routeOrders(orders: Order[], warehouses: Warehouse[], zones: Zones, warehousesForcedOff: string[]): RouteResult[] {
  const warehousesWithStock: Warehouse[] = JSON.parse(JSON.stringify(warehouses));
  const results: RouteResult[] = [];

  for (const order of orders) {
    const result = routeOrder(order, warehousesWithStock, zones, warehousesForcedOff);
    results.push(result);
  }

  return results;
}

function routeOrder(order: Order, warehouses: Warehouse[], zones: Zones, warehousesForcedOff: string[]): RouteResult {
  if (order. country !== "US") {
    return sendToPartner(order, `outside US (${order.country})`);
  }

  if (order.zip === null) {
    return sendToPartner(order, "no valid zip");
  }

  const zipPrefix = order.zip.slice(0, 3);

  if (!isZipPrefixKnown(zipPrefix, warehouses, zones)) {
    return sendToPartner(order, `zip prefix ${zipPrefix} not in zones`);
  }

  const options = findWarehousesThatCanShip(order, zipPrefix, warehouses, zones, warehousesForcedOff);

  let normalBestCode: string | null = null;

  if (warehousesForcedOff.length > 0) {
    const optionsWithEveryWarehouse = findWarehousesThatCanShip(order, zipPrefix, warehouses, zones, []);

    if (optionsWithEveryWarehouse.length > 0) {
      normalBestCode = pickBestOption(optionsWithEveryWarehouse).warehouse.code;
    }
  }

  if (options.length === 0) {
    if (normalBestCode !== null) {
      order.notes.push(`${normalBestCode} is down, sent to PARTNER instead`);
    }

    return sendToPartner(order, "no warehouse can ship the whole order");
  }

  const bestOption = pickBestOption(options);

  if (normalBestCode !== null && normalBestCode !== bestOption.warehouse.code) {
    order.notes.push(`${normalBestCode} is down, sent to ${bestOption.warehouse.code} instead`);
  }

  reserveStock(bestOption.warehouse, order);

  return {
    orderNumber: order.orderNumber,
    destination: bestOption.warehouse.code,
    reason: `zone ${bestOption.zone}`,
    notes: order.notes,
  };
}

function sendToPartner(order: Order, reason: string): RouteResult {
  return {
    orderNumber: order.orderNumber,
    destination: "PARTNER",
    reason: reason,
    notes: order.notes,
  };
}

function isZipPrefixKnown(zipPrefix: string, warehouses: Warehouse[], zones: Zones): boolean {
  for (const warehouse of warehouses) {
    const zonesOfWarehouse = zones[warehouse.code];

    if (zonesOfWarehouse !== undefined && zonesOfWarehouse[zipPrefix] !== undefined) {
      return true;
    }
  }

  return false;
}

function findWarehousesThatCanShip(order: Order, zipPrefix: string, warehouses: Warehouse[], zones: Zones, warehousesForcedOff: string[]): WarehouseOption[] {
  const options: WarehouseOption[] = [];

  for (const warehouse of warehouses) {
    if (!warehouse.enabled) {
      continue;
    }

    if (warehousesForcedOff.includes(warehouse.code)) {
      continue;
    }

    if (!hasStockForWholeOrder(warehouse, order)) {
      continue;
    }

    const zone = zones[warehouse.code][zipPrefix];

    if (zone === undefined) {
      continue;
    }

    options.push({
      warehouse: warehouse,
      zone: zone,
      daysOfCover: calculateDaysOfCover(warehouse, order),
    });
  }

  return options;
}

function hasStockForWholeOrder(warehouse: Warehouse, order: Order): boolean {
  for (const line of order.lines) {
    const stock = warehouse.inventory[line.sku];

    if (stock === undefined || stock.available < line.quantity) {
      return false;
    }
  }

  return true;
}

function calculateDaysOfCover(warehouse: Warehouse, order: Order): number {
  let smallestDaysOfCover = Infinity;

  for (const line of order.lines) {
    const stock = warehouse.inventory[line.sku];

    if (stock.dailyVelocity === 0) {
      continue;
    }

    const daysOfCover = stock.available / stock.dailyVelocity;

    if (daysOfCover < smallestDaysOfCover) {
      smallestDaysOfCover = daysOfCover;
    }
  }

  return smallestDaysOfCover;
}

function pickBestOption(options: WarehouseOption[]): WarehouseOption {
  let bestOption = options[0];

  for (const option of options) {
    if (isBetterOption(option, bestOption)) {
      bestOption = option;
    }
  }

  return bestOption;
}

function isBetterOption(option: WarehouseOption, currentBest: WarehouseOption): boolean {
  if (option.zone !== currentBest.zone) {
    return option.zone < currentBest.zone;
  }

  if (option.daysOfCover !== currentBest.daysOfCover) {
    return option.daysOfCover > currentBest.daysOfCover;
  }

  const optionPriority = TIE_BREAK_PRIORITY.indexOf(option.warehouse.code);
  const currentBestPriority = TIE_BREAK_PRIORITY.indexOf(currentBest.warehouse.code);

  return optionPriority < currentBestPriority;
}

function reserveStock(warehouse: Warehouse, order: Order): void {
  for (const line of order.lines) {
    warehouse.inventory[line.sku].available = warehouse.inventory[line.sku].available - line.quantity;
  }
}
