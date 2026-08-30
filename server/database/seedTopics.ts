import { db, initDatabase } from './db.js';

export interface TopicSeedData {
  name: string;
  slug: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  keywords: string[];
}

export const INITIAL_TOPICS: TopicSeedData[] = [
  // CORE AI
  {
    name: 'AI Models',
    slug: 'ai-models',
    category: 'CORE AI',
    description: 'Frontier foundation models, LLMs, reasoning architectures, and parameter scalability.',
    icon: 'neurology',
    color: '#4b41e1',
    keywords: ['llm', 'foundation model', 'gpt', 'claude', 'gemini', 'llama', 'mistral', 'reasoning model', 'transformer', 'weights', 'parameters', 'fine-tuning']
  },
  {
    name: 'AI Research',
    slug: 'ai-research',
    category: 'CORE AI',
    description: 'Peer-reviewed papers, algorithmic breakthroughs, loss functions, and architectural advancements.',
    icon: 'menu_book',
    color: '#8b5cf6',
    keywords: ['arxiv', 'research paper', 'benchmark', 'ablation', 'loss function', 'neural architecture', 'deepmind', 'openai research', 'fair', 'scaling laws']
  },
  {
    name: 'Generative AI',
    slug: 'generative-ai',
    category: 'CORE AI',
    description: 'Diffusion models, synthetic data generation, text-to-anything pipelines, and creative AI.',
    icon: 'auto_awesome',
    color: '#ec4899',
    keywords: ['generative ai', 'genai', 'diffusion', 'synthetic data', 'image generation', 'text-to-image', 'midjourney', 'stable diffusion', 'sora', 'runway']
  },
  {
    name: 'Multimodal AI',
    slug: 'multimodal-ai',
    category: 'CORE AI',
    description: 'Unified vision, audio, text, and spatial understanding cross-modal models.',
    icon: 'filter_b_and_w',
    color: '#06b6d4',
    keywords: ['multimodal', 'vision-language', 'vlm', 'audio model', 'speech recognition', 'whisper', 'gemini vision', 'gpt-4o', 'visual reasoning']
  },

  // DEVELOPMENT
  {
    name: 'AI Agents',
    slug: 'ai-agents',
    category: 'DEVELOPMENT',
    description: 'Autonomous systems, agentic workflows, tool use, computer use, and multi-agent AI.',
    icon: 'smart_toy',
    color: '#3b82f6',
    keywords: ['agent', 'agentic', 'autonomous agent', 'computer use', 'tool calling', 'multi-agent', 'langchain', 'autogen', 'crewai', 'orch', 'agent memory', 'workflow automation']
  },
  {
    name: 'AI Coding',
    slug: 'ai-coding',
    category: 'DEVELOPMENT',
    description: 'Code generation engines, AI pair programmers, automated code review, and IDE integrations.',
    icon: 'code',
    color: '#10b981',
    keywords: ['copilot', 'cursor', 'code generation', 'ai pair programmer', 'swe-bench', 'devin', 'codex', 'starcoder', 'refactoring', 'unit test generation']
  },
  {
    name: 'Developer Tools',
    slug: 'developer-tools',
    category: 'DEVELOPMENT',
    description: 'SDKs, vector databases, evaluation suites, prompt engineering frameworks, and observability.',
    icon: 'handyman',
    color: '#6366f1',
    keywords: ['vector database', 'pinecone', 'chroma', 'qdrant', 'evals', 'langsmith', 'prompt engineering', 'rag', 'retrieval augmented', 'llamaindex', 'vllm', 'ollama']
  },
  {
    name: 'Open Source AI',
    slug: 'open-source-ai',
    category: 'DEVELOPMENT',
    description: 'Open weights, Hugging Face repositories, community models, and local inference tooling.',
    icon: 'folder_open',
    color: '#f59e0b',
    keywords: ['open source', 'open weights', 'hugging face', 'ollama', 'llama.cpp', 'localllama', 'gguf', 'vllm', 'apache 2.0', 'mit license', 'unsloth']
  },

  // HARDWARE
  {
    name: 'AI Hardware',
    slug: 'ai-hardware',
    category: 'HARDWARE',
    description: 'Accelerators, GPU clusters, TPUs, custom silicon, and wafer-scale computing systems.',
    icon: 'memory',
    color: '#ef4444',
    keywords: ['gpu', 'tpu', 'npu', 'nvidia', 'amd', 'intel', 'h100', 'b200', 'groq', 'cerebras', 'silicon', 'semiconductor', 'wafer', 'hbm3']
  },
  {
    name: 'AI Chips',
    slug: 'ai-chips',
    category: 'HARDWARE',
    description: 'Specialized NPU IP cores, neuromorphic microchips, and edge inference processors.',
    icon: 'developer_board',
    color: '#dc2626',
    keywords: ['chiplet', 'npu', 'edge ai', 'turing', 'blackwell', 'gaudi', 'custom silicon', 'tsmc', 'fab', 'nanometer']
  },
  {
    name: 'AI Infrastructure',
    slug: 'ai-infrastructure',
    category: 'HARDWARE',
    description: 'Data center liquid cooling, high-throughput interconnects, cluster networking, and cloud providers.',
    icon: 'dns',
    color: '#64748b',
    keywords: ['datacenter', 'cluster', 'liquid cooling', 'infiniBand', 'ethernet', 'lambda labs', 'coreweave', 'nebius', 'aws', 'azure', 'google cloud', 'vertex']
  },

  // EMERGING TECHNOLOGY
  {
    name: 'Robotics',
    slug: 'robotics',
    category: 'EMERGING TECHNOLOGY',
    description: 'Humanoid robots, spatial AI, embodied foundation models, and physical manipulation.',
    icon: 'precision_manufacturing',
    color: '#84cc16',
    keywords: ['robotics', 'humanoid', 'embodied ai', 'figure 01', 'boston dynamics', 'tesla optimus', 'unitree', 'spatial intelligence', 'rt-2', 'covaria']
  },
  {
    name: 'Scientific AI',
    slug: 'scientific-ai',
    category: 'EMERGING TECHNOLOGY',
    description: 'Protein folding, molecular design, climate modeling, fusion physics, and material discovery.',
    icon: 'science',
    color: '#a855f7',
    keywords: ['alphafold', 'protein folding', 'drug discovery', 'scientific ai', 'materials science', 'genomics', 'fusion', 'quantum ai', 'crispr']
  },
  {
    name: 'Voice AI',
    slug: 'voice-ai',
    category: 'EMERGING TECHNOLOGY',
    description: 'Real-time conversational speech synthesis, low-latency audio LLMs, and voice cloning.',
    icon: 'mic',
    color: '#14b8a6',
    keywords: ['voice ai', 'elevenlabs', 'text-to-speech', 'speech-to-speech', 'voice cloning', 'audio llm', 'conversational ai', 'vocal synthesis']
  },

  // BUSINESS
  {
    name: 'AI Startups',
    slug: 'ai-startups',
    category: 'BUSINESS',
    description: 'Early-stage AI ventures, stealth launches, YC cohorts, and seed-round breakthroughs.',
    icon: 'rocket_launch',
    color: '#f97316',
    keywords: ['startup', 'stealth', 'y combinator', 'yc', 'seed round', 'series a', 'founder', 'incubation']
  },
  {
    name: 'AI Products',
    slug: 'ai-products',
    category: 'BUSINESS',
    description: 'Consumer apps, enterprise SaaS integrations, platform rollouts, and feature launches.',
    icon: 'category',
    color: '#0284c7',
    keywords: ['product launch', 'feature update', 'saas', 'enterprise product', 'chatgpt', 'claude.ai', 'perplexity', 'notion ai']
  },
  {
    name: 'Funding & Acquisitions',
    slug: 'funding-acquisitions',
    category: 'BUSINESS',
    description: 'Venture funding rounds, strategic investments, M&A transactions, and tech valuations.',
    icon: 'payments',
    color: '#15803d',
    keywords: ['funding', 'valuation', 'acquisition', 'invested', 'raise', 'venture capital', 'vc', 'a16z', 'sequoia', 'benchmark', 'lightspeed']
  },

  // TRUST & GOVERNANCE
  {
    name: 'AI Safety',
    slug: 'ai-safety',
    category: 'TRUST & GOVERNANCE',
    description: 'Alignment research, mechanistic interpretability, red-teaming, and catastrophic risk mitigation.',
    icon: 'gavel',
    color: '#ea580c',
    keywords: ['ai safety', 'alignment', 'interpretability', 'red-teaming', 'jailbreak', 'catastrophic risk', 'safety institute', 'aisi', 'anthropic safety']
  },
  {
    name: 'AI Security',
    slug: 'ai-security',
    category: 'TRUST & GOVERNANCE',
    description: 'Prompt injection defenses, data poisoning, model extraction risks, and agent vulnerability scanning.',
    icon: 'shield',
    color: '#b91c1c',
    keywords: ['prompt injection', 'data poisoning', 'adversarial attack', 'model security', 'llm vulnerability', 'cve', 'cybersecurity ai', 'exfiltration']
  },
  {
    name: 'AI Regulation',
    slug: 'ai-regulation',
    category: 'TRUST & GOVERNANCE',
    description: 'Government policy, EU AI Act, executive orders, copyright lawsuits, and global standards.',
    icon: 'policy',
    color: '#475569',
    keywords: ['eu ai act', 'regulation', 'executive order', 'copyright', 'lawsuit', 'ftc', 'compliance', 'governance', 'policy', 'legislation']
  }
];

export function seedTopics() {
  initDatabase();

  const insertTopic = db.prepare(`
    INSERT INTO topics (name, slug, category, description, icon, color)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name=excluded.name,
      category=excluded.category,
      description=excluded.description,
      icon=excluded.icon,
      color=excluded.color
  `);

  const insertKeyword = db.prepare(`
    INSERT INTO topic_keywords (topic_id, keyword, weight)
    VALUES (?, ?, ?)
  `);

  const insertPref = db.prepare(`
    INSERT OR IGNORE INTO topic_preferences (user_id, topic_id, followed, notification_level)
    VALUES ('default_user', ?, 1, 'IMPORTANT')
  `);

  for (const t of INITIAL_TOPICS) {
    insertTopic.run(t.name, t.slug, t.category, t.description, t.icon, t.color);
    
    const topicRow = db.prepare('SELECT id FROM topics WHERE slug = ?').get(t.slug) as any;
    if (topicRow) {
      db.prepare('DELETE FROM topic_keywords WHERE topic_id = ?').run(topicRow.id);
      for (const kw of t.keywords) {
        insertKeyword.run(topicRow.id, kw.toLowerCase(), 1.0);
      }

      // Default follow high-signal core topics
      if (['ai-agents', 'ai-coding', 'ai-models', 'open-source-ai'].includes(t.slug)) {
        insertPref.run(topicRow.id);
      }
    }
  }

  console.log(`[SeedTopics] Successfully seeded ${INITIAL_TOPICS.length} default topics and keyword taxonomies.`);
}

// Run immediately when imported
seedTopics();
