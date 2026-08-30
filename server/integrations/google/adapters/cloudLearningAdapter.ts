// server/integrations/google/adapters/cloudLearningAdapter.ts
import { RawDiscoveredResource } from './skillsGoogleAdapter.js';

export const OFFICIAL_CLOUD_LEARNING_RESOURCES: RawDiscoveredResource[] = [
  {
    skill_id: 'google-deepmind-transformer-architectures-lab',
    title: 'DeepMind Transformer Architectures & Attention Mechanics',
    description: 'Deep technical exploration of self-attention mechanisms, rotary position embeddings (RoPE), and KV-cache optimizations authored by DeepMind researchers.',
    official_url: 'https://deepmind.google/technologies',
    resource_type: 'TUTORIAL',
    difficulty: 'Advanced',
    duration: '3 hours',
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago (NEW)
    thumbnail_url: 'https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9zqoA7hOQ=w200-h200',
    mapped_skill_slugs: ['large-language-models', 'generative-ai'],
    prerequisite_skill_slugs: ['large-language-models'],
    why_learn_this_summary: 'Fundamental architecture mastery for high-throughput model fine-tuning and inference optimization.'
  },
  {
    skill_id: 'google-professional-ml-engineer-cert',
    title: 'Google Professional Machine Learning Engineer Certification Track',
    description: 'Comprehensive industry certification pathway covering end-to-end ML architectures, Vertex AI Pipelines, model evaluation, and MLOps deployment standards.',
    official_url: 'https://cloud.google.com/learn/certification/machine-learning-engineer',
    resource_type: 'CERTIFICATION',
    difficulty: 'Advanced',
    duration: '16 hours',
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail_url: 'https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9zqoA7hOQ=w200-h200',
    mapped_skill_slugs: ['mlops', 'large-language-models'],
    prerequisite_skill_slugs: ['generative-ai'],
    why_learn_this_summary: 'Industry-standard credential for senior enterprise machine learning engineering.'
  },
  {
    skill_id: 'google-responsible-ai-safety-guardrails',
    title: 'Responsible AI & Adversarial Red-Teaming for LLMs',
    description: 'Implement automated red-teaming, prompt injection defense, output filtering, and constitutional guardrails using Google AI safety principles.',
    official_url: 'https://ai.google/responsibility/principles',
    resource_type: 'COURSE',
    difficulty: 'Intermediate',
    duration: '2.5 hours',
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (NEW)
    thumbnail_url: 'https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9zqoA7hOQ=w200-h200',
    mapped_skill_slugs: ['ai-security', 'generative-ai'],
    prerequisite_skill_slugs: ['generative-ai'],
    why_learn_this_summary: 'AI Security is vital as autonomous agents interface with production APIs and databases.'
  },
  {
    skill_id: 'google-multimodal-vision-audio-gemini',
    title: 'Multimodal Video & Audio Reasoning with Gemini Live APIs',
    description: 'Build real-time cross-modal perception systems processing synchronized video streams, audio input, and spatial reasoning tasks.',
    official_url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/overview',
    resource_type: 'HANDS_ON_LAB',
    difficulty: 'Advanced',
    duration: '3.5 hours',
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago (NEW)
    thumbnail_url: 'https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9zqoA7hOQ=w200-h200',
    mapped_skill_slugs: ['multimodal-ai', 'generative-ai'],
    prerequisite_skill_slugs: ['generative-ai', 'large-language-models'],
    why_learn_this_summary: 'Multimodal AI momentum is at 84/100 with massive expansion in vision-language models.'
  }
];

export async function fetchCloudLearningResources(): Promise<RawDiscoveredResource[]> {
  return OFFICIAL_CLOUD_LEARNING_RESOURCES;
}
