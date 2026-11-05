export type OrderLine = {
  sku: string;
  quantity: number;
};

export type OrderCreatedEvent = {
  type: "order_created";
  orderNumber: string;
  at: string;
  shipTo: {
    country?: string;
    state?: string;
    zip?: string | number | null;
  };
  lines: OrderLine[];
};

export type OrderEditedEvent = {
  type: "order_edited";
  orderNumber: string;
  at: string;
  addedLines: OrderLine[];
};

export type OrderEvent = OrderCreatedEvent | OrderEditedEvent;

export type Warehouse = {
  code: string;
  city: string;
  enabled: boolean;
  inventory: Record<string, { available: number; dailyVelocity: number }>;
};

export type Zones = Record<string, Record<string, number>>;

export type Bundle = {
  sku: string;
  name: string;
  components: OrderLine[];
};

export type Catalog = {
  products: { sku: string; name: string }[];
  bundles: Bundle[];
};

export type Order = {
  orderNumber: string;
  createdAt: Date;
  country: string;
  zip: string | null;
  lines: OrderLine[];
  notes: string[];
};

export type RouteResult = {
  orderNumber: string;
  destination: string;
  reason: string;
  notes: string[];
};
