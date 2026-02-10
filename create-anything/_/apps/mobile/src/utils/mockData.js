export const getMockScanResult = () => ({
  id: Date.now().toString(),
  product: "Dove Soap",
  expiry: "December 2026",
  mfgDate: "January 2024",
  warnings: ["Contains fragrance allergens"],
  ingredients: [
    "Sodium Palmate",
    "Water",
    "Fragrance",
    "Glycerin",
    "Sodium Cocoate",
  ],
  allergens: ["Fragrance", "Coconut-derived"],
  confidence: 0.98,
  scannedAt: new Date().toISOString(),
  rawText: "Dove Beauty Bar\nIngredients: Sodium Palmate, Water, Fragrance, Glycerin, Sodium Cocoate.\nWarnings: May contain fragrance allergens.\nManufactured: Jan 2024. Expires: Dec 2026.",
  summary: "Dove Soap. Expires December 2026. Warning: Contains fragrance allergens.",
  summaryBullets: [
    "Product: Dove Soap",
    "Expires: December 2026",
    "Warnings: Contains fragrance allergens",
  ],
});

export const getAlternateMockResults = () => [
  {
    id: "1",
    product: "Organic Honey",
    expiry: "March 2027",
    mfgDate: "June 2024",
    warnings: ["Not suitable for infants under 1 year"],
    ingredients: ["100% Pure Organic Honey"],
    confidence: 0.95,
    scannedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "2",
    product: "Almond Milk",
    expiry: "November 2025",
    mfgDate: "October 2024",
    warnings: ["Contains tree nuts", "Refrigerate after opening"],
    ingredients: ["Filtered Water", "Almonds", "Sea Salt", "Natural Flavors"],
    confidence: 0.92,
    scannedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];
