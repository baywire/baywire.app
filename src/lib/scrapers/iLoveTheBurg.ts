import { createTribeEventsAdapter } from "./tribeEvents";

/**
 * I Love the Burg — St. Petersburg blog running The Events Calendar plugin,
 * which exposes /wp-json/tribe/events/v1/events. Structured data so we don't
 * need to scrape HTML cards.
 */
export const iLoveTheBurgAdapter = createTribeEventsAdapter({
  slug: "ilovetheburg",
  label: "I Love the Burg",
  baseUrl: "https://ilovetheburg.com",
});
