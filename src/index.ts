import { readFile, writeFile } from "node:fs/promises";
import { buildOrders } from "./buildOrders";
import { routeOrders } from "./routeOrders";
import { Catalog, OrderEvent, RouteResult, Warehouse, Zones } from "./types";

async function readJson(fileName: string) {
  const content = await readFile(`data/${fileName}`, "utf-8");
  return JSON.parse(content);
}

function formatResult(result: RouteResult): string {
  const line = `${result.orderNumber.padEnd(7)} ${result.destination.padEnd(8)} ${result.reason}`;

  if (result.notes.length === 0) {
    return line;
  }

  return `${line.padEnd(55)} | ${result.notes.join("; ")}`;
}

async function main() {
  const isNevadaDown = process.argv.includes("--nv-down");
  const warehousesForcedOff = isNevadaDown ? ["WH-NV"] : [];
  const outputFileName = isNevadaDown ? "routes-nv-down.txt" : "routes.txt";

  const events: OrderEvent[] = await readJson("orders.json");
  const warehouses: Warehouse[] = await readJson("warehouses.json");
  const zones: Zones = await readJson("zones.json");
  const catalog: Catalog = await readJson("catalog.json");

  const orders = buildOrders(events, catalog);
  const results = routeOrders(orders, warehouses, zones, warehousesForcedOff);

  const outputLines: string[] = [];

  for (const result of results) {
    outputLines.push(formatResult(result));
  }

  const output = outputLines.join("\n") + "\n";

  console.log(output);
  await writeFile(outputFileName, output, "utf-8");
}

main();
