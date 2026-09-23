export interface SearchWebResultItem {
  title: string;
  link: string;
  snippet: string;
}

export interface ScrapeResultItem {
  url: string;
  success: boolean;
  data: string;
}

export interface ScrapePagesOutput {
  error?: string;
  results?: ScrapeResultItem[];
}
