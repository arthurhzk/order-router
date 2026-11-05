# order-router

A small TypeScript tool that decides which warehouse ships each order for Natura Wellness, a fictional supplement brand used as sample data.

The goal is simple: send every order to the closest warehouse that can ship the whole order in one parcel.

## How it works

1. **Read the data** from `data/`: orders, warehouses with their stock, shipping zones and the product catalog.
2. **Build the orders** from the event list:
   - edits made within 30 minutes of an order are merged into it, later ones are ignored
   - bundles are split into their products
   - messy input is cleaned up (lowercase SKUs, ZIPs that lost a leading zero, ZIP+4, `USA` instead of `US`)
3. **Route each order**, oldest first:
   - only warehouses that have stock for every item are considered
   - the lowest shipping zone wins
   - on a tie, the warehouse with more days of stock left wins, then a fixed priority order
   - the chosen warehouse's stock is reserved, so later orders see what's left
4. **Send to PARTNER** when the order can't be shipped by us: outside the US, no valid ZIP, unknown ZIP area, or no warehouse can ship it all.

Every adjustment is noted next to the order, so it's easy to see why it was routed that way.

## Running

```bash
npm install
npm run route          # writes routes.txt
npm run route:nv-down  # same, but with the Nevada warehouse offline
npm test
```

## Output

Each line shows the order, where it goes and why:

```
#2033   WH-NJ    zone 3    | zip came as number 2134, fixed to 02134
#2037   PARTNER  outside US (CA)
#2041   WH-GA    zone 7    | edit added 1x NW-MULTI-30
```

`routes-nv-down.txt` shows what changes when a warehouse goes down: its orders move to the next best option, or to PARTNER if nobody else can ship them.

## Structure

```
src/
  index.ts          entry point, reads data and writes the output
  buildOrders.ts    turns events into clean orders
  cleanData.ts      small helpers to fix ZIPs, SKUs and countries
  routeOrders.ts    picks the warehouse for each order
  types.ts          shared types
```
