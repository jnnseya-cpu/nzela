/**
 * StackFood v1 REST API types — Integration Spec §3–§7. Field names follow
 * the standard StackFood release; verify against the Postman export from
 * drc.tunakula.com before production (the spec is the contract, the export
 * is ground truth for field names).
 */

export interface StackFoodConfig {
  baseUrl: string;
  /** Zone header value for catalog endpoints, e.g. [1]. */
  zoneIds?: number[];
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
}

export interface Restaurant {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  open: 0 | 1;
  delivery_time: string;
  avg_rating: number;
  cover_photo_full_url?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  restaurant_id: number;
  image_full_url?: string;
  available_time_starts?: string;
  available_time_ends?: string;
}

export interface CartLine {
  food_id: number;
  item_campaign_id?: number | null;
  price: number;
  variant?: string;
  variations?: unknown[];
  add_ons?: number[];
  add_on_qtys?: number[];
  quantity: number;
}

export type PaymentMethod =
  | "cash_on_delivery"
  | "wallet"
  | "offline_payment";

export interface PlaceOrderPayload {
  cart: CartLine[];
  order_amount: number;
  payment_method: PaymentMethod;
  order_type: "delivery";
  restaurant_id: number;
  distance: number;
  address: string;
  latitude: string;
  longitude: string;
  contact_person_name: string;
  contact_person_number: string;
  address_type: string;
  road: string;
  house: string;
  floor: string;
  dm_tips: number;
  /** Always carries the NZELA short code, e.g. "NZELA TK-347 · sans piment". */
  order_note: string;
  schedule_at: string | null;
  payment_info?: Record<string, string>;
}

export type StackFoodOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "handover"
  | "picked_up"
  | "delivered"
  | "canceled"
  | "failed"
  | "refunded";

export interface OrderStatusUpdate {
  order_id: number;
  status: StackFoodOrderStatus;
  processing_time?: number;
}

/** Observer webhook payload (Integration Spec §7.2). */
export interface StatusWebhookPayload {
  event: "order.status_changed";
  order_id: number;
  old_status: StackFoodOrderStatus;
  new_status: StackFoodOrderStatus;
  payment_status: string;
  restaurant_id: number;
  delivery_man_id: number | null;
  ts: string;
}
