export interface AIRecommendationPayload {
  title: string;
  reason: string;
  signals: string[];
  confidence: number;
  expectedImpact: string;
  suggestedAction: string;
  overrideNote?: string;
}
