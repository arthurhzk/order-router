import { Catalog, OrderLine } from "./types";

export function cleanCountry(rawCountry: string | undefined): string {
  if (rawCountry === undefined) {
    return "";
  }

  const country = rawCountry.trim().toUpperCase();

  if (country === "USA" || country === "UNITED STATES") {
    return "US";
  }

  return country;
}

export function cleanSku(rawSku: string): string {
  return rawSku.trim().toUpperCase();
}

export function cleanZip(rawZip: string | number | null | undefined): string | null {
  if (rawZip === null || rawZip === undefined) {
    return null;
  }

  let zip = String(rawZip).trim();

  if (zip === "") {
    return null;
  }

  if (typeof rawZip === "number") {
    zip = zip.padStart(5, "0");
  }

  const firstFiveCharacters = zip.slice(0, 5);

  if (!isOnlyDigits(firstFiveCharacters) || firstFiveCharacters.length !== 5) {
    return null;
  }

  return firstFiveCharacters;
}

function isOnlyDigits(text: string): boolean {
  for (const character of text) {
    if (character < "0" || character > "9") {
      return false;
    }
  }

  return true;
}

export function findBundle(catalog: Catalog, sku: string) {
  for (const bundle of catalog.bundles) {
    if (bundle.sku === sku) {
      return bundle;
    }
  }

  return undefined;
}

export function addLine(lines: OrderLine[], sku: string, quantity: number): void {
  for (const line of lines) {
    if (line.sku === sku) {
      line.quantity = line.quantity + quantity;
      return;
    }
  }

  lines.push({ sku: sku, quantity: quantity });
}
