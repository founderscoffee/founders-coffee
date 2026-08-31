import { hero_social_proof, type Locale } from '@founders-coffee/i18n';

type CitySelectionFeedbackProps = {
  locale: Locale;
  selectedCityCount: number;
  cityDisplayName: string;
};

export const CitySelectionFeedback = ({
  locale,
  selectedCityCount,
  cityDisplayName,
}: CitySelectionFeedbackProps) => (
  <div className="mt-5 inline-flex items-center gap-2 text-sm text-success">
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
    {hero_social_proof(
      { count: selectedCityCount, city: cityDisplayName },
      { locale },
    )}
  </div>
);
