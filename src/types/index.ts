export interface StoryCluster {
  id: number;
  cluster_title: string;
  summary: string;
  why_it_matters?: string;
  key_points?: string[];
  importance_score: number;
  credibility_score: number;
  confidence_score: number;
  radar_score: number;
  status: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'CONTRADICTED';
  category: string;
  breaking: boolean;
  primary_source_name?: string;
  primary_source_url?: string;
  first_seen_at: string;
  last_updated_at: string;
  supporting_count?: number;
  supporting_sources?: Article[];
}

export interface Article {
  id: number;
  source_id: number;
  title: string;
  description: string;
  url: string;
  canonical_url: string;
  author?: string;
  published_at: string;
  image_url?: string;
  importance_score: number;
  credibility_score: number;
  confidence_score: number;
  source_name?: string;
  source_domain?: string;
  source_type?: string;
}

export interface EarlySignal {
  id: number;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  signal_type: 'PAPER' | 'GITHUB' | 'COMMUNITY' | 'REPOS';
  confidence: 'Low' | 'Medium' | 'High';
  status: 'WATCHING' | 'PROMOTED' | 'DISMISSED';
  discovered_at: string;
}

export interface MonitoredSource {
  id: number;
  name: string;
  url: string;
  rss_url: string;
  source_type: 'PRIMARY' | 'CREDIBLE_NEWS' | 'DISCOVERY' | 'COMMUNITY';
  reliability_score: number;
  active: boolean | number;
  last_checked?: string;
  last_success?: string;
  error_count: number;
}

export interface DashboardStats {
  articles_analyzed_today: number;
  important_developments: number;
  breaking_count: number;
  sources_monitored: number;
  last_updated: string;
}
