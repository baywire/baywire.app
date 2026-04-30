import { Eyebrow, Heading, Text } from "@/design-system";

interface PlacesHeroIntroProps {
  totalCount: number;
}

export function PlacesHeroIntro({ totalCount }: PlacesHeroIntroProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow className="mb-2">
        AI-curated · Local favorites
      </Eyebrow>
      <Heading level="display">
        Discover the best spots in{" "}
        <span className="bg-linear-to-r from-sunset-500 to-gulf-500 bg-clip-text text-transparent">
          Tampa Bay
        </span>
      </Heading>
      <Text variant="muted" className="mx-auto mt-3 max-w-xl text-balance sm:text-base">
        Restaurants, breweries, bars, parks, and hidden gems across Tampa, St. Pete,
        Clearwater, and beyond.
      </Text>
      {totalCount > 0 && (
        <Text variant="meta" className="mt-3">
          {totalCount} curated places
        </Text>
      )}
    </div>
  );
}
