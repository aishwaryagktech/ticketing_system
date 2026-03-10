export interface AIProviderConfig {
  id: string;
  product_id?: string | null;
  provider_name: string;
  enabled: boolean;
  available_models: string[];
  default_model?: string | null;
}

export interface ClassifyResult {
  category: string;
  sub_category?: string;
  priority: string;
  confidence: number;
}
