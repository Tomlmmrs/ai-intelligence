/**
 * Paper importance filter — determines whether a research paper
 * should appear in general feeds or only in deep-research views.
 *
 * The key question is NOT "is this technically valid?"
 * but rather: "Will a broader AI-focused audience care about this?"
 */

export type PaperDepth = "general" | "intermediate" | "advanced";
export type PaperInclusionReason =
  | "major_lab"
  | "capability_shift"
  | "product_relevant"
  | "open_source_impact"
  | "safety_alignment"
  | "community_attention"
  | "efficiency_breakthrough"
  | "benchmark_record"
  | "agent_tool_use"
  | "multimodal_advance"
  | "none";

export interface PaperScore {
  /** Overall paper importance for general audience (0-100) */
  broadRelevance: number;
  /** Practical relevance to builders/practitioners (0-100) */
  practicalRelevance: number;
  /** How much ecosystem impact this likely has (0-100) */
  ecosystemImpact: number;
  /** How readable this is for non-specialists (0-100) */
  accessibility: number;
  /** Lab/venue prestige signal (0-100) */
  sourcePrestige: number;
  /** Composite paper score (0-100) */
  composite: number;
  /** Recommended depth level */
  depth: PaperDepth;
  /** Why this paper is included (if it passes filter) */
  inclusionReason: PaperInclusionReason;
  /** Should this paper appear in the main feed? */
  showInMainFeed: boolean;
  /** Should this paper appear in a research-focused feed? */
  showInResearchFeed: boolean;
}

// ─── Major labs whose papers get automatic attention ─────────────────

const MAJOR_LABS = [
  "openai", "anthropic", "google", "deepmind", "google deepmind",
  "meta", "meta ai", "fair", "microsoft", "microsoft research",
  "nvidia", "apple", "amazon", "baidu", "alibaba", "tencent",
  "bytedance", "samsung", "mistral", "cohere", "stability",
  "xai", "inflection", "databricks", "together ai", "hugging face",
];

// ─── High-signal topic patterns (papers the broad audience cares about) ──

const HIGH_SIGNAL_PATTERNS: { pattern: RegExp; weight: number; reason: PaperInclusionReason }[] = [
  // Major capability shifts
  { pattern: /\b(gpt[-\s]?[4-9]|claude[-\s]?[3-9]|gemini[-\s]?[2-9]|llama[-\s]?[3-9]|phi[-\s]?[3-9]|grok[-\s]?[2-9])/i, weight: 30, reason: "capability_shift" },
  { pattern: /\b(state[- ]of[- ]the[- ]art|sota|surpass|outperform|new record)\b/i, weight: 20, reason: "benchmark_record" },
  { pattern: /\b(breakthrough|paradigm shift|first[- ]ever|world'?s first)\b/i, weight: 25, reason: "capability_shift" },

  // Agent/tool use — very product-relevant
  { pattern: /\b(agent|agentic|tool[- ]use|function[- ]call|planning|autonomous)\b/i, weight: 15, reason: "agent_tool_use" },
  { pattern: /\b(code[- ]generation|code[- ]agent|software[- ]engineer|swe[- ]bench)\b/i, weight: 18, reason: "product_relevant" },

  // Multimodal advances
  { pattern: /\b(multimodal|vision[- ]language|text[- ]to[- ]image|text[- ]to[- ]video|image[- ]understanding)\b/i, weight: 12, reason: "multimodal_advance" },
  { pattern: /\b(video[- ]generation|image[- ]generation|3d[- ]generation)\b/i, weight: 10, reason: "multimodal_advance" },

  // Efficiency/inference — product impact
  { pattern: /\b(quantization|distillation|pruning|efficient[- ]inference|faster[- ]inference)\b/i, weight: 10, reason: "efficiency_breakthrough" },
  { pattern: /\b(mixture[- ]of[- ]experts|moe|sparse[- ]model|scaling[- ]law)\b/i, weight: 12, reason: "efficiency_breakthrough" },
  { pattern: /\b(context[- ]window|long[- ]context|million[- ]token|128k|256k|1m)\b/i, weight: 12, reason: "capability_shift" },

  // Open source impact
  { pattern: /\b(open[- ]source|open[- ]weight|permissive|apache|mit license)\b/i, weight: 12, reason: "open_source_impact" },
  { pattern: /\b(hugging\s*face|model[- ]hub|weights[- ]released)\b/i, weight: 10, reason: "open_source_impact" },

  // Safety/alignment — ecosystem relevance
  { pattern: /\b(alignment|safety|rlhf|constitutional|red[- ]team|jailbreak|guardrail)\b/i, weight: 12, reason: "safety_alignment" },
  { pattern: /\b(hallucination|factuality|truthful|decepti)/i, weight: 10, reason: "safety_alignment" },

  // Reasoning/chain-of-thought — broad interest
  { pattern: /\b(reasoning|chain[- ]of[- ]thought|cot|step[- ]by[- ]step|self[- ]correct)\b/i, weight: 12, reason: "capability_shift" },
  { pattern: /\b(in[- ]context[- ]learning|few[- ]shot|zero[- ]shot|prompt)\b/i, weight: 8, reason: "product_relevant" },

  // RAG/retrieval — very product-relevant
  { pattern: /\b(retrieval[- ]augmented|rag|knowledge[- ]base|vector[- ]search|embeddings)\b/i, weight: 12, reason: "product_relevant" },

  // Fine-tuning — practitioner relevance
  { pattern: /\b(fine[- ]tun|lora|qlora|peft|adapter|instruction[- ]tun)\b/i, weight: 10, reason: "product_relevant" },

  // Benchmark/evaluation improvements
  { pattern: /\b(benchmark|leaderboard|evaluation|arena|elo)\b/i, weight: 8, reason: "benchmark_record" },
];

// ─── Low-signal patterns (niche/narrow research) ─────────────────────

const NICHE_PATTERNS: RegExp[] = [
  // Medical/biomedical niche (unless clearly AI-focused)
  /\b(clinical|patholog|radiology|diagnos|medical imaging|drug discovery|protein folding|genomic|biomarker)\b/i,
  /\b(cancer|tumor|disease|patient|hospital|surgery|therapeutic)\b/i,

  // Narrow domain applications
  /\b(geospatial|seismic|weather forecast|climate model|traffic predict|crop|agriculture)\b/i,
  /\b(underwater|satellite|remote sensing|lidar|sonar|radar)\b/i,
  /\b(industrial|manufactur|defect detect|quality control|supply chain)\b/i,

  // Highly specialized math/theory
  /\b(banach|hilbert|manifold|topolog|homomorphi|lattice|markov chain)\b/i,
  /\b(regret bound|convergence rate|sample complexity|PAC learn|vc dimension)\b/i,

  // Narrow CV applications
  /\b(face recognit|pose estimat|gait|re-identification|pedestrian|crowd count)\b/i,
  /\b(autonomous driv|lane detect|lidar point|3d object detect|depth estim)\b/i,

  // Narrow NLP applications
  /\b(sentiment analysis|named entity|relation extract|part-of-speech|dependency pars)\b/i,
  /\b(machine translat|low-resource language|morpholog|phonolog|syntax)\b/i,

  // Robotics niche (unless clearly about AI agents)
  /\b(robot arm|manipulat|locomotion|grasping|dexterous|humanoid robot)\b/i,

  // Signal/audio niche
  /\b(speech enhancement|noise reduction|speaker diariz|acoustic|phoneme)\b/i,

  // Incremental methodology
  /\b(ablation study|hyperparameter|learning rate|batch size|regulariz|dropout)\b/i,

  // Graph/network niche
  /\b(graph neural|knowledge graph|link prediction|node classif|community detect)\b/i,

  // Time series niche
  /\b(time series forecast|anomaly detect|change point|seasonal|autoregress)\b/i,
];

// ─── Jargon that signals academic-only content ───────────────────────

const HEAVY_JARGON_PATTERNS: RegExp[] = [
  /\b(heteroscedastic|variational|posterior|bayesian|stochastic gradient)\b/i,
  /\b(contrastive learning|self-supervised|pretext task|representation learning)\b/i,
  /\b(equivariant|invariant|disentangle|latent space|manifold)\b/i,
  /\b(attention mechanism|transformer block|feedforward|normalization layer)\b/i,
  /\b(cross-entropy|kl divergence|wasserstein|f-divergence)\b/i,
  /\b(ablation|hyperparameter sweep|grid search|neural architecture search)\b/i,
];

// ─── Scoring functions ──────────────────────────────────────────────

/**
 * Score a paper for broad relevance and decide whether it belongs
 * in the main feed, research feed, or should be suppressed entirely.
 */
export function scorePaper(
  title: string,
  content: string,
  source: string,
  company?: string | null,
): PaperScore {
  const text = `${title} ${content}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // 1. Source prestige
  let sourcePrestige = 50;
  const sourceLower = source.toLowerCase();
  const companyLower = (company ?? "").toLowerCase();

  const isFromMajorLab = MAJOR_LABS.some(
    (lab) => sourceLower.includes(lab) || companyLower.includes(lab) || text.includes(lab)
  );
  if (isFromMajorLab) sourcePrestige = 85;

  // HF daily papers are curated — higher prestige
  if (sourceLower.includes("hf_papers") || sourceLower.includes("hugging")) {
    sourcePrestige = Math.max(sourcePrestige, 72);
  }

  // arXiv is raw — low base prestige unless from a known lab
  if (sourceLower.includes("arxiv")) {
    sourcePrestige = isFromMajorLab ? 78 : 40;
  }

  // 2. High-signal pattern matching
  let broadRelevance = 20; // Low base for papers
  let bestReason: PaperInclusionReason = "none";
  let bestReasonWeight = 0;

  for (const { pattern, weight, reason } of HIGH_SIGNAL_PATTERNS) {
    if (pattern.test(text)) {
      broadRelevance += weight;
      if (weight > bestReasonWeight) {
        bestReasonWeight = weight;
        bestReason = reason;
      }
    }
  }

  // 3. Niche penalty
  let nichePenalty = 0;
  for (const pattern of NICHE_PATTERNS) {
    if (pattern.test(text)) {
      nichePenalty += 15;
    }
  }
  // Cap the penalty
  nichePenalty = Math.min(nichePenalty, 50);
  broadRelevance = Math.max(0, broadRelevance - nichePenalty);

  // 4. Practical relevance
  let practicalRelevance = 30;
  if (/\b(api|sdk|library|framework|tool|deploy|production|inference)\b/i.test(text)) {
    practicalRelevance += 20;
  }
  if (/\b(code|implement|github|repo|pip install|npm|docker)\b/i.test(text)) {
    practicalRelevance += 15;
  }
  if (/\b(benchmark|evaluation|comparison|vs\b|versus)\b/i.test(text)) {
    practicalRelevance += 10;
  }

  // 5. Accessibility (how readable for non-specialists)
  let accessibility = 60;
  let jargonCount = 0;
  for (const pattern of HEAVY_JARGON_PATTERNS) {
    if (pattern.test(text)) jargonCount++;
  }
  accessibility -= jargonCount * 10;
  accessibility = Math.max(10, accessibility);

  // Simple title readability: short titles with common words are more accessible
  if (title.length > 100) accessibility -= 10;
  if (/^[A-Z][^:]+:/.test(title) && title.includes(":")) {
    // Pattern like "CoolName: A Long Technical Subtitle" — common in papers
    accessibility -= 5;
  }

  // 6. Ecosystem impact
  let ecosystemImpact = 20;
  if (isFromMajorLab) ecosystemImpact += 25;
  if (/\b(open[- ]source|released|available|weights|model card)\b/i.test(text)) {
    ecosystemImpact += 15;
  }
  if (/\b(scaling|billion|trillion|parameter)\b/i.test(text)) {
    ecosystemImpact += 10;
  }

  // 7. Compute composite
  const composite = Math.round(
    broadRelevance * 0.30 +
    practicalRelevance * 0.20 +
    ecosystemImpact * 0.20 +
    accessibility * 0.15 +
    sourcePrestige * 0.15
  );

  // 8. Determine depth level and feed placement
  let depth: PaperDepth;
  let showInMainFeed: boolean;
  let showInResearchFeed: boolean;

  if (composite >= 55 || (isFromMajorLab && composite >= 45)) {
    depth = "general";
    showInMainFeed = true;
    showInResearchFeed = true;
  } else if (composite >= 35) {
    depth = "intermediate";
    showInMainFeed = false;
    showInResearchFeed = true;
  } else {
    depth = "advanced";
    showInMainFeed = false;
    showInResearchFeed = composite >= 20; // Very niche papers excluded even from research feed
  }

  // Major lab papers always at least show in research feed
  if (isFromMajorLab) {
    showInResearchFeed = true;
    if (composite >= 40) showInMainFeed = true;
  }

  return {
    broadRelevance: clamp(broadRelevance),
    practicalRelevance: clamp(practicalRelevance),
    ecosystemImpact: clamp(ecosystemImpact),
    accessibility: clamp(accessibility),
    sourcePrestige: clamp(sourcePrestige),
    composite: clamp(composite),
    depth,
    inclusionReason: bestReason,
    showInMainFeed,
    showInResearchFeed,
  };
}

function clamp(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)));
}

// ─── Paper summary rewriting ────────────────────────────────────────

/**
 * Transform an academic abstract into a plain-English summary.
 * This is a heuristic rewriter — not LLM-powered (that can be added later).
 * It focuses on:
 * 1. Extracting the key contribution
 * 2. Simplifying jargon
 * 3. Producing a "why it matters" and "who should care" statement
 */
export function rewritePaperSummary(
  title: string,
  abstract: string,
  paperScore: PaperScore,
): {
  summary: string;
  whyItMatters: string;
  whoShouldCare: string;
  bottomLine: string;
} {
  // Extract the first 1-2 meaningful sentences from the abstract
  const sentences = splitSentences(abstract);
  let coreSummary = "";

  // Find the most informative sentence (skip "In this paper, we..." boilerplate)
  const skipPatterns = [
    /^in this (paper|work|study)/i,
    /^we (propose|present|introduce|describe|show)/i,
    /^this (paper|work|study) (proposes|presents|introduces)/i,
    /^recent (advances|progress|work)/i,
  ];

  const goodSentences: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length < 20) continue;
    if (skipPatterns.some((p) => p.test(trimmed))) {
      // Rewrite "We propose X" -> "X"
      const rewritten = trimmed
        .replace(/^(in this (paper|work|study),?\s*)/i, "")
        .replace(/^(we|the authors?|this (paper|work))\s+(propose|present|introduce|describe|demonstrate)s?\s+/i, "Introduces ")
        .replace(/^(we|the authors?)\s+(show|find|observe|demonstrate)\s+that\s+/i, "Shows that ");
      goodSentences.push(rewritten);
    } else {
      goodSentences.push(trimmed);
    }
    if (goodSentences.length >= 2) break;
  }

  coreSummary = goodSentences.join(" ");
  if (!coreSummary) {
    coreSummary = abstract.slice(0, 200).trim();
  }

  // Apply jargon simplification
  coreSummary = simplifyJargon(coreSummary);

  // Cap length
  if (coreSummary.length > 250) {
    coreSummary = coreSummary.slice(0, 247).trim() + "...";
  }

  // Generate "why it matters" based on inclusion reason
  const whyItMatters = generateWhyItMatters(title, paperScore);
  const whoShouldCare = generateWhoShouldCare(paperScore);
  const bottomLine = generateBottomLine(title, paperScore);

  return { summary: coreSummary, whyItMatters, whoShouldCare, bottomLine };
}

function splitSentences(text: string): string[] {
  // Simple sentence splitter
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((s) => s.length > 10);
}

const JARGON_MAP: [RegExp, string][] = [
  [/\bsparse mixture[- ]of[- ]experts\b/gi, "a technique that activates only parts of the model for each query, improving efficiency"],
  [/\bmixture[- ]of[- ]experts\b/gi, "a design where different model components specialize in different tasks"],
  [/\bchain[- ]of[- ]thought\b/gi, "step-by-step reasoning"],
  [/\bin[- ]context[- ]learning\b/gi, "learning from examples within the prompt"],
  [/\bretrieval[- ]augmented generation\b/gi, "combining AI generation with external knowledge lookup"],
  [/\bfine[- ]tun(e|ed|ing)\b/gi, "customizing a pre-trained model for specific tasks"],
  [/\bRLHF\b/g, "learning from human feedback"],
  [/\bself[- ]supervised\b/gi, "trained on unlabeled data"],
  [/\bcontrastive learning\b/gi, "a training method that teaches models to distinguish similar from different items"],
  [/\blatent space\b/gi, "the model's internal representation"],
  [/\bquantization\b/gi, "compressing models to use less memory"],
  [/\bdistillation\b/gi, "transferring knowledge from a large model to a smaller one"],
  [/\battention mechanism\b/gi, "the component that helps models focus on relevant parts of input"],
  [/\btransformer\b/gi, "the architecture behind most modern AI models"],
  [/\bfew[- ]shot\b/gi, "learning from just a few examples"],
  [/\bzero[- ]shot\b/gi, "performing tasks without specific training examples"],
  [/\bembedding(s)?\b/gi, "numerical representation(s)"],
  [/\bperplexity\b/gi, "a measure of model quality"],
  [/\bablation (study|experiment)\b/gi, "testing by removing components"],
  [/\bPEFT\b/g, "parameter-efficient fine-tuning"],
  [/\bLoRA\b/g, "a lightweight fine-tuning method"],
  [/\bQLoRA\b/g, "a memory-efficient fine-tuning method"],
];

function simplifyJargon(text: string): string {
  let result = text;
  for (const [pattern, replacement] of JARGON_MAP) {
    if (typeof replacement === "string") {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

function generateWhyItMatters(title: string, score: PaperScore): string {
  switch (score.inclusionReason) {
    case "capability_shift":
      return "This research could meaningfully advance what AI systems can do, potentially shaping future models and products.";
    case "product_relevant":
      return "This has direct implications for how AI products are built and deployed.";
    case "open_source_impact":
      return "This contributes to the open-source AI ecosystem, potentially enabling broader access to advanced capabilities.";
    case "safety_alignment":
      return "This addresses AI safety or alignment, which matters as AI systems become more capable and widely deployed.";
    case "efficiency_breakthrough":
      return "This could make AI systems cheaper, faster, or more accessible by improving how models run.";
    case "benchmark_record":
      return "This sets new performance standards, indicating progress in AI capabilities.";
    case "agent_tool_use":
      return "This advances how AI systems can act autonomously and use tools, a key direction for next-generation AI products.";
    case "multimodal_advance":
      return "This pushes forward AI's ability to work across text, images, and other media.";
    case "community_attention":
      return "This paper is getting significant attention from the AI community.";
    case "major_lab":
      return "Coming from a leading AI lab, this research often signals what major AI products will look like next.";
    default:
      return "This research touches on areas relevant to the broader AI landscape.";
  }
}

function generateWhoShouldCare(score: PaperScore): string {
  const audiences: string[] = [];

  if (score.practicalRelevance >= 50) audiences.push("AI engineers and builders");
  if (score.ecosystemImpact >= 50) audiences.push("AI product teams");
  if (score.broadRelevance >= 60) audiences.push("anyone tracking AI progress");

  if (score.inclusionReason === "safety_alignment") {
    audiences.push("AI safety researchers and policymakers");
  }
  if (score.inclusionReason === "open_source_impact") {
    audiences.push("the open-source AI community");
  }
  if (score.inclusionReason === "efficiency_breakthrough") {
    audiences.push("teams deploying AI at scale");
  }

  if (audiences.length === 0) {
    return score.depth === "general"
      ? "AI practitioners and industry observers"
      : "AI researchers and advanced practitioners";
  }

  return capitalizeFirst(audiences.slice(0, 3).join(", "));
}

function generateBottomLine(title: string, score: PaperScore): string {
  if (score.composite >= 70) {
    return "Likely significant — worth reading even if you're not deep in research.";
  }
  if (score.composite >= 55) {
    return "Notable research with real-world implications.";
  }
  if (score.composite >= 40) {
    return "Interesting research, mainly relevant for practitioners in this area.";
  }
  return "Specialized research — relevant for domain experts.";
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
