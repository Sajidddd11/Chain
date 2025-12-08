declare global {
  interface WindowEventMap {
    'inventory:view-store-product': CustomEvent<{ productId?: string | null }>;
  }
}

export {};

