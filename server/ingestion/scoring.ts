export interface ArticleAnalysis {
  category: string;
  importance_score: number;
  credibility_score: number;
  confidence_score: number;
  radar_score: number;
  breaking: boolean;
  status: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'CONTRADICTED';
  is_early_signal: boolean;
}

export function classifyArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (/\b(model release|launches|unveils|introduces|gpt-4|gpt-5|claude|gemini|llama|deepseek|mistral|o3|o1|qwen|weights)\b/.test(text)) {
    return 'MODEL RELEASE';
  }
  if (/\b(agent|agents|agentic|autonomous|autogpt|crewai)\b/.test(text)) {
    return 'AI AGENTS';
  }
  if (/\b(coding|copilot|cursor|code generation|developer tools|ide|sdk|langchain|llamaindex)\b/.test(text)) {
    return 'AI CODING';
  }
  if (/\b(paper|arxiv|research|breakthrough|benchmark|dataset|architecture|training)\b/.test(text)) {
    return 'RESEARCH';
  }
  if (/\b(open source|weights|hugging face|github|llama|local model)\b/.test(text)) {
    return 'OPEN SOURCE';
  }
  if (/\b(robot|robotics|humanoid|figure|boston dynamics)\b/.test(text)) {
    return 'ROBOTICS';
  }
  if (/\b(chip|chips|gpu|nvidia|h100|b200|blackwell|tpu|semiconductor|tscm)\b/.test(text)) {
    return 'AI HARDWARE';
  }
  if (/\b(safety|security|vulnerability|jailbreak|alignment|risk|cybersecurity)\b/.test(text)) {
    return 'SAFETY';
  }
  if (/\b(regulation|eu ai act|policy|ftc|lawsuit|copyright|white house|bill)\b/.test(text)) {
    return 'AI REGULATION';
  }
  if (/\b(funding|raised|valuation|investment|acquisition|acquires|billion|million)\b/.test(text)) {
    return 'FUNDING';
  }
  if (/\b(image|video|sora|runway|pika|flux|midjourney|generative|diffusion|speech|elevenlabs)\b/.test(text)) {
    return 'GENERATIVE AI';
  }

  return 'PRODUCT';
}

export function analyzeArticle(
  title: string,
  description: string,
  sourceType: string,
  sourceReliability: number,
  supportingCount: number = 1
): ArticleAnalysis {
  const text = `${title} ${description}`.toLowerCase();
  const category = classifyArticle(title, description);

  let importance = 40;

  // Importance Bonuses
  if (category === 'MODEL RELEASE') importance += 30;
  if (category === 'RESEARCH') importance += 20;
  if (category === 'AI AGENTS') importance += 18;
  if (category === 'AI HARDWARE') importance += 15;
  if (category === 'SAFETY' || category === 'AI REGULATION') importance += 15;
  if (category === 'OPEN SOURCE') importance += 15;
  if (sourceType === 'PRIMARY') importance += 20;
  if (supportingCount > 1) importance += Math.min(15, supportingCount * 4);

  // Anti-Hype Penalties (PRD Part 2)
  if (/\b(top 10|top 5|10 tools|best ai tools|change your life|must try|you won't believe|secret|trick|make money|passive income|game changer|mind blowing|prompt engineering secrets)\b/i.test(text)) {
    importance -= 40;
  }
  if (/\b(reportedly|rumor|might|could be|unconfirmed|speculation)\b/i.test(text)) {
    importance -= 15;
  }

  importance = Math.max(10, Math.min(99, importance));

  // Credibility Score (0.0 to 1.0)
  const credibility = Math.max(0.15, Math.min(1.0, sourceReliability));

  // Confidence Calculation
  let confidence = 50;
  if (sourceType === 'PRIMARY') {
    confidence = 100;
  } else if (sourceType === 'CREDIBLE_NEWS') {
    confidence = supportingCount > 1 ? 85 : 70;
  } else if (sourceType === 'DISCOVERY') {
    confidence = 60;
  } else if (sourceType === 'COMMUNITY') {
    confidence = 40;
  }

  if (/\b(rumor|reportedly|speculation)\b/.test(text)) {
    confidence = Math.min(confidence, 35);
  }

  // Determine Status
  let status: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'CONTRADICTED' = 'REPORTED';
  if (confidence >= 90) status = 'CONFIRMED';
  else if (confidence >= 65) status = 'REPORTED';
  else status = 'UNVERIFIED';

  // Radar Score (Signal Index)
  const radarScore = Math.round((importance * 0.45) + (credibility * 100 * 0.35) + (confidence * 0.20));

  // Breaking Detection
  const breaking = (importance >= 80 && confidence >= 70) || (sourceType === 'PRIMARY' && importance >= 75);

  // Early Signal Check
  const isEarlySignal = (sourceType === 'COMMUNITY' || category === 'RESEARCH') && confidence < 75;

  return {
    category,
    importance_score: importance,
    credibility_score: credibility,
    confidence_score: confidence,
    radar_score: Math.min(99, Math.max(10, radarScore)),
    breaking,
    status,
    is_early_signal: isEarlySignal,
  };
}
