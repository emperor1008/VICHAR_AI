export interface CrisisResource {
  countryCode: string;
  country: string;
  emergency: string;
  directoryUrl: string;
  note: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    countryCode: "IN",
    country: "India",
    emergency: "112",
    directoryUrl: "https://findahelpline.com/countries/in",
    note: "If there is immediate danger, call 112 or go to the nearest emergency department.",
  },
  {
    countryCode: "GLOBAL",
    country: "International",
    emergency: "Your local emergency number",
    directoryUrl: "https://findahelpline.com",
    note: "Use the directory to find a verified crisis line in your location.",
  },
];

export function getCrisisResources(countryCode: string): CrisisResource {
  const code = countryCode.toUpperCase();
  return CRISIS_RESOURCES.find((resource) => resource.countryCode === code)
    ?? CRISIS_RESOURCES[CRISIS_RESOURCES.length - 1];
}
