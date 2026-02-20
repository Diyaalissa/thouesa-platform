export type UserRole = "CUSTOMER" | "ADMIN";

export type OrderDirection = "JO_TO_DZ" | "DZ_TO_JO";
export type OrderStatus =
  | "PENDING_REVIEW"
  | "AWAITING_PAYMENT"
  | "PAYMENT_UNDER_REVIEW"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

export type PaymentMethod = "VISA" | "CLICK_JO" | "MANUAL";

export interface PricingEstimate {
  direction: OrderDirection;
  weightKg: number;
  estimatedPrice: number;
  currency: "JOD" | "DZD";
}
