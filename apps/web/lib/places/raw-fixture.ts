/**
 * Strings shaped like real Google Places `name` fields. Used only to simulate
 * upstream payloads inside server-side anonymization — never returned to clients.
 */
export const RAW_GOOGLE_PLACE_NAMES_FOR_QA = [
  "Mamma Mia Pizzeria",
  "Starbucks Reserve",
  "Il Fornaio",
  "Chipotle Mexican Grill",
] as const;
