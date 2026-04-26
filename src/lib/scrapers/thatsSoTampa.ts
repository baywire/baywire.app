import { createTribeEventsAdapter } from "./tribeEvents";

/**
 * That's So Tampa — sister blog to I Love the Burg covering the Tampa side of
 * the bay; same WordPress + Tribe Events stack so we share the JSON API
 * adapter factory.
 */
export const thatsSoTampaAdapter = createTribeEventsAdapter({
  slug: "thats_so_tampa",
  label: "That's So Tampa",
  baseUrl: "https://thatssotampa.com",
});
