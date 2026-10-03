/** Non-catalogue seed data: hubs, delivery zones, chat channels, settings, users, reviews, landing page. */

export const HUBS = [
  { code: "lagos", name: "Lagos Hub (Ikeja)", city: "Ikeja", state: "Lagos", fallback: false, sort: 1 },
  { code: "abuja", name: "Abuja Hub (Wuse II)", city: "Wuse II", state: "FCT", fallback: false, sort: 2 },
  { code: "warehouse", name: "Central Warehouse (Agbara)", city: "Agbara", state: "Ogun", fallback: true, sort: 3 },
] as const;

/** [state, fee ₦, etaMin, etaMax, sameDay, hub] for all 36 states + FCT. */
export const ZONES: [string, number, number, number, boolean, string][] = [
  ["Lagos", 2_500, 1, 1, true, "lagos"],
  ["FCT", 3_000, 1, 2, true, "abuja"],
  ["Ogun", 3_500, 1, 2, false, "lagos"],
  ["Oyo", 3_500, 2, 3, false, "lagos"],
  ["Osun", 4_000, 2, 3, false, "lagos"],
  ["Ondo", 4_000, 2, 3, false, "lagos"],
  ["Ekiti", 4_000, 2, 4, false, "lagos"],
  ["Kwara", 4_000, 2, 4, false, "lagos"],
  ["Edo", 4_000, 2, 3, false, "lagos"],
  ["Delta", 4_000, 2, 3, false, "lagos"],
  ["Rivers", 4_500, 2, 3, false, "warehouse"],
  ["Bayelsa", 5_000, 3, 4, false, "warehouse"],
  ["Akwa Ibom", 5_000, 3, 4, false, "warehouse"],
  ["Cross River", 5_000, 3, 4, false, "warehouse"],
  ["Anambra", 4_500, 2, 4, false, "warehouse"],
  ["Enugu", 4_500, 2, 4, false, "warehouse"],
  ["Imo", 4_500, 2, 4, false, "warehouse"],
  ["Abia", 4_500, 2, 4, false, "warehouse"],
  ["Ebonyi", 5_000, 3, 4, false, "warehouse"],
  ["Niger", 4_000, 2, 3, false, "abuja"],
  ["Nasarawa", 3_500, 1, 3, false, "abuja"],
  ["Kogi", 4_000, 2, 3, false, "abuja"],
  ["Benue", 4_500, 2, 4, false, "abuja"],
  ["Plateau", 4_500, 2, 4, false, "abuja"],
  ["Kaduna", 4_000, 2, 3, false, "abuja"],
  ["Kano", 4_500, 2, 4, false, "abuja"],
  ["Katsina", 5_000, 3, 5, false, "abuja"],
  ["Jigawa", 5_000, 3, 5, false, "abuja"],
  ["Bauchi", 5_000, 3, 5, false, "abuja"],
  ["Gombe", 5_000, 3, 5, false, "abuja"],
  ["Kebbi", 5_500, 3, 5, false, "abuja"],
  ["Sokoto", 5_500, 3, 5, false, "abuja"],
  ["Zamfara", 5_500, 3, 5, false, "abuja"],
  ["Taraba", 5_500, 3, 5, false, "abuja"],
  ["Adamawa", 5_500, 3, 5, false, "abuja"],
  ["Yobe", 6_000, 4, 6, false, "abuja"],
  ["Borno", 6_000, 4, 6, false, "abuja"],
];

/** Placeholder business numbers/handles — the owner sets real ones in Admin → Chat & Payments. */
export const CHAT_CHANNELS = [
  { key: "wa-lagos", kind: "whatsapp", label: "WhatsApp (Lagos desk)", handle: "+2348120008899", hub: "lagos", weight: 1, enabled: true, sort: 1 },
  { key: "wa-abuja", kind: "whatsapp", label: "WhatsApp (Abuja desk)", handle: "+2348120008900", hub: "abuja", weight: 1, enabled: true, sort: 2 },
  { key: "instagram", kind: "instagram", label: "Instagram DM", handle: "mubazzar.ng", hub: null, weight: 1, enabled: true, sort: 3 },
  { key: "messenger", kind: "messenger", label: "Facebook Messenger", handle: "mubazzarng", hub: null, weight: 1, enabled: false, sort: 4 },
  { key: "telegram", kind: "telegram", label: "Telegram", handle: "mubazzar", hub: null, weight: 1, enabled: false, sort: 5 },
  { key: "phone", kind: "phone", label: "Phone call", handle: "+2348120008899", hub: null, weight: 1, enabled: true, sort: 6 },
] as const;

export const SETTINGS: { key: string; value: unknown; isPublic: boolean; description: string }[] = [
  {
    key: "promo_strip",
    value: "🇳🇬 Fast Nationwide Delivery | Pay on Delivery available — arrange in chat | 24/7 WhatsApp Support",
    isPublic: true,
    description: "Top announcement strip",
  },
  {
    key: "hero",
    value: {
      badge: "MEGA FLASH SALE",
      badgeNote: "Limited Stock",
      headline: "Up to {max_discount}% Off Viral Smart Gadgets",
      highlight: "{max_discount}% Off",
      subtext: "Free gifts on selected gadgets. Pay on Delivery available in Lagos, Abuja & nationwide — arrange in chat.",
      ctaLabel: "Claim Your Deal Today",
      ctaHref: "/deals",
      imageUrl: null,
    },
    isPublic: true,
    description: "Home hero banner. {max_discount} is computed live from active products.",
  },
  {
    key: "trust_bar",
    value: [
      { icon: "verified_user", text: "Pay on Delivery — arrange in chat", tone: "emerald" },
      { icon: "restart_alt", text: "7-Day Free Returns", tone: "gold" },
      { icon: "chat", text: "WhatsApp Dispatch Alerts", tone: "emerald" },
      { icon: "fact_check", text: "Tested Before Dispatch", tone: "gold" },
    ],
    isPublic: true,
    description: "Navy trust strip under the home search bar",
  },
  { key: "same_day_cutoff", value: "14:00", isPublic: true, description: "Same-day delivery cut-off (Africa/Lagos, 24h HH:MM)" },
  {
    key: "support",
    value: { whatsapp: "+2348120008899", phone: "+2348120008899", hours: "Mon - Sat: 8AM - 8PM", email: "support@mubazzar.ng" },
    isPublic: true,
    description: "Customer support contacts",
  },
  {
    key: "business",
    value: {
      legalName: "MUBAZZAR Nigeria Ltd.",
      address: "Lekki Expressway, Victoria Island, Lagos, Nigeria",
      cac: "RC — to be provided",
      returnsDays: 7,
    },
    isPublic: true,
    description: "Compliance details shown in the footer",
  },
  { key: "flash_section", value: { title: "Flash Deals", subtitle: "Prices end when the timer hits zero" }, isPublic: true, description: "Flash deal section copy" },
  { key: "show_sample_reviews", value: true, isPublic: true, description: "Show seeded sample reviews (labelled). Turn off in production." },
  // ── Private (admin/staff) ──
  {
    key: "bank_accounts",
    value: [{ bank: "Moniepoint MFB", accountName: "MUBAZZAR NIGERIA LTD", accountNumber: "0000000000" }],
    isPublic: false,
    description: "Official accounts staff copy into chat. Never shown on public pages.",
  },
  { key: "whatsapp_routing", value: "by_hub", isPublic: false, description: "by_hub | round_robin | first" },
  { key: "chat_templates", value: {}, isPublic: false, description: "Overrides for customer/staff message templates" },
  { key: "auto_cancel_hours", value: 48, isPublic: false, description: "Auto-cancel unpaid orders still awaiting chat after N hours" },
  { key: "follow_up_after_hours", value: 12, isPublic: false, description: "Show unpaid orders in the staff follow-up list after N hours" },
  {
    key: "admin_alerts",
    value: { emails: ["admin@mubazzar.test"], phones: ["+2348030000001"] },
    isPublic: false,
    description: "Who receives new-order alerts",
  },
];

export interface SeedUser {
  key: string;
  email: string;
  phone: string;
  password: string;
  fullName: string;
  role: "admin" | "staff" | "dispatcher" | "supplier" | "customer";
  hub?: string;
}

/** Dev/test accounts — one per role. Never seeded into production (see db:seed-sql --no-users). */
export const USERS: SeedUser[] = [
  { key: "admin", email: "admin@mubazzar.test", phone: "+2348030000001", password: "Admin#2026!", fullName: "Ada Owner", role: "admin" },
  { key: "staff", email: "staff@mubazzar.test", phone: "+2348030000002", password: "Staff#2026!", fullName: "Sola Staff", role: "staff" },
  { key: "dispatcher", email: "dispatch@mubazzar.test", phone: "+2348030000003", password: "Dispatch#2026!", fullName: "Musa Rider", role: "dispatcher", hub: "lagos" },
  { key: "supplier", email: "supplier@mubazzar.test", phone: "+2348030000004", password: "Supplier#2026!", fullName: "Kemi Supplier", role: "supplier" },
  { key: "customer", email: "customer@mubazzar.test", phone: "+2348030000005", password: "Customer#2026!", fullName: "Chinedu Customer", role: "customer" },
];

export const SAMPLE_SUPPLIER = {
  businessName: "Kemi Gadgets Enterprise",
  contactName: "Kemi Supplier",
  phone: "+2348030000004",
  email: "supplier@mubazzar.test",
  cac: "BN 1234567",
  categories: ["Kitchen Hacks", "Home Tech"],
};

/** Sample reviews — always stored with is_sample = true and labelled in the UI. */
export const SAMPLE_REVIEWS: { product: string; name: string; location: string; rating: number; body: string; daysAgo: number }[] = [
  { product: "turbo-car-vacuum", name: "Chidi O.", location: "Lekki Phase 1, Lagos", rating: 5, daysAgo: 2, body: "Abeg this thing na fire! I was skeptical because of fake things online. The suction power strong well-well. It pulled out all the gala crumbs and sand my children left under the Prado back seats. Rider arrived in 24hrs." },
  { product: "turbo-car-vacuum", name: "Hajiya Fatima A.", location: "Gwarinpa, Abuja", rating: 5, daysAgo: 4, body: "Delivered in less than 2 days here in Abuja. The delivery guy allowed me to unbox and switch it on before I paid. The air blower cleared all the dust in my AC vents that car wash boys always ignore." },
  { product: "turbo-car-vacuum", name: "Engr. Bamidele K.", location: "GRA, Port Harcourt", rating: 5, daysAgo: 6, body: "I bought the 2-pack bundle to give my wife one. Battery lasts very well. Fits right inside the front door pocket. Solid build quality from Mubazzar." },
  { product: "turbo-car-vacuum", name: "Chinedu A.", location: "Lekki Phase 1, Lagos", rating: 5, daysAgo: 2, body: "I was skeptical about Pay on Delivery, but the dispatcher arrived with POS and the car vacuum is 100% genuine power! Mubazzar is my new go-to." },
  { product: "turbo-car-vacuum", name: "Ifeoma N.", location: "Independence Layout, Enugu", rating: 4, daysAgo: 9, body: "Very handy for quick clean-ups. Took 3 days to Enugu but the team kept me updated on WhatsApp." },
  { product: "electric-veggie-chopper", name: "Hajiya Maryam", location: "Maitama, Abuja", rating: 5, daysAgo: 1, body: "The rechargeable vegetable chopper saved my prep time for Ramadan soups. Delivered in 48 hours to Abuja safely packaged. Highly recommended!" },
  { product: "electric-veggie-chopper", name: "Funmi A.", location: "Bodija, Ibadan", rating: 5, daysAgo: 11, body: "Pepper for stew in seconds. My mother-in-law wants one now." },
  { product: "magnetic-solar-wall-light", name: "Tari Ebi", location: "GRA, Port Harcourt", rating: 5, daysAgo: 3, body: "The solar wall light survived heavy rainy season downpours without tripping. Sensor is super sensitive. Top quality product." },
  { product: "magnetic-solar-wall-light", name: "Ibrahim S.", location: "Nassarawa GRA, Kano", rating: 4, daysAgo: 8, body: "Bright enough for my gate. Wish the box came with more screws but the magnets hold well." },
  { product: "smart-anti-snore-device", name: "Tunde B.", location: "Surulere, Lagos", rating: 4, daysAgo: 5, body: "My wife says the snoring has reduced a lot. Took a few nights to get used to it." },
  { product: "slim-solar-powerbank-20000", name: "Amaka E.", location: "Wuse II, Abuja", rating: 5, daysAgo: 7, body: "Charges my phone twice and the built-in cables mean no more borrowing chargers." },
  { product: "retractable-car-charger-3in1", name: "Segun P.", location: "Ikeja GRA, Lagos", rating: 5, daysAgo: 10, body: "The voltage display warned me my battery was dying before it packed up. Nice one." },
  { product: "ultrasonic-pest-repeller-2pack", name: "Blessing U.", location: "Uyo, Akwa Ibom", rating: 4, daysAgo: 14, body: "Rats stopped coming to the kitchen after about a week." },
  { product: "mini-thermal-printer", name: "Zainab M.", location: "Barnawa, Kaduna", rating: 5, daysAgo: 12, body: "I use it for my small chops business labels. Customers love the stickers." },
  { product: "100w-braided-multi-cable", name: "Emeka O.", location: "Awka, Anambra", rating: 5, daysAgo: 20, body: "Strong cable, charges fast. Bought three for the house." },
  { product: "automatic-water-dispenser-pump", name: "Grace I.", location: "Benin City, Edo", rating: 5, daysAgo: 16, body: "No more lifting the big bottle. One charge lasted almost a month." },
  { product: "magnetic-door-window-alarm", name: "Yusuf D.", location: "Jabi, Abuja", rating: 5, daysAgo: 13, body: "Very loud siren. Installed on my shop door in two minutes." },
  { product: "cordless-tyre-inflator", name: "Kola A.", location: "Abeokuta, Ogun", rating: 5, daysAgo: 18, body: "Saved me at night on the expressway. Auto-stop works perfectly." },
  { product: "rechargeable-solar-standing-fan", name: "Ngozi C.", location: "Owerri, Imo", rating: 4, daysAgo: 21, body: "Runs through the night on battery. A bit heavy but very strong breeze." },
  { product: "bladeless-neck-fan", name: "Damilola F.", location: "Yaba, Lagos", rating: 4, daysAgo: 6, body: "Perfect for BRT queues. Hair doesn't get caught." },
];

export const LANDING_PAGE = {
  slug: "car-vacuum",
  product: "turbo-car-vacuum",
  hookLabel: "PROMO ALERT",
  hookBanner: "⚡ 48% OFF + Free Luxury Car Diffuser | Pay on Delivery available — arrange in chat",
  trendBadge: "#1 Trending Car Gadget in Nigeria",
  headline: "Stop Paying Car Wash ~~₦4,000~~ Every Week!",
  subheadline:
    "Blow stubborn AC sand, pull deep coin crumbs, and inflate car tires in 60 seconds with the **Mubazzar 4-in-1 Turbo Cordless Handheld Jet Vacuum**.",
  heroOverlayText: "9,000Pa Turbo Vortex Engine",
  heroOverlayIcon: "electric_meter",
  warrantyBadge: "1-Year Warranty",
  regionsText: "Lagos • Abuja • PH • Kano",
  featuresTitle: "Why Nigerian Drivers Love This 4-in-1 Beast",
  featuresSubtitle: "Designed to handle dusty dry harmattan seasons, roadside potholes sand, and everyday quick interior touchups.",
  videoUrl: null,
  videoPoster: "vacuum-demo.webp",
  videoTitle: "See It Lift Coins & Sand",
  videoSubtitle: "Real demo inside a Nigerian car",
  ctaLabel: "Place Order & Pay on WhatsApp",
  seoTitle: "4-in-1 Turbo Cordless Car Vacuum — Pay on Delivery | MUBAZZAR",
  seoDescription:
    "Vacuum, blow, inflate and deflate with one cordless 9,000Pa device. Same-day delivery in Lagos & Abuja, nationwide in 2–4 days. Order now and pay on WhatsApp.",
  trustMatrix: [
    { icon: "payments", title: "Pay On Delivery (Arrange in Chat)", body: "Agree Pay on Delivery with our team on WhatsApp, then inspect and test before paying the rider by cash, POS or transfer." },
    { icon: "rocket_launch", title: "Express Delivery Time", body: "Same-day in Lagos & Abuja before the daily cut-off. 2 to 4 working days across all 36 states." },
    { icon: "verified_user", title: "12 Months Mubazzar Warranty", body: "Any factory fault? We replace it completely free with no hassle." },
  ],
};
