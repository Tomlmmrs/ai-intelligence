import { describe, it, expect } from "vitest";
import { scorePaper, rewritePaperSummary, type PaperScore } from "./paper-filter";

// ─── scorePaper ──────────────────────────────────────────────────────

describe("scorePaper", () => {
  it("gives high score to major lab papers", () => {
    const score = scorePaper(
      "GPT-5: A New Frontier in Language Understanding",
      "OpenAI presents GPT-5, a breakthrough in reasoning and planning capabilities.",
      "openai_blog",
      "OpenAI"
    );
    expect(score.showInMainFeed).toBe(true);
    expect(score.showInResearchFeed).toBe(true);
    expect(score.sourcePrestige).toBeGreaterThanOrEqual(78);
    expect(score.depth).toBe("general");
    expect(score.composite).toBeGreaterThanOrEqual(45);
  });

  it("filters niche medical papers from main feed", () => {
    const score = scorePaper(
      "Automated Radiology Diagnosis Using Deep Learning for Tumor Detection",
      "We propose a novel approach to clinical pathology diagnosis using convolutional neural networks for cancer detection in hospital settings.",
      "arxiv_cs_ai"
    );
    expect(score.showInMainFeed).toBe(false);
    expect(score.broadRelevance).toBeLessThan(40);
  });

  it("filters narrow NLP papers from main feed", () => {
    const score = scorePaper(
      "Improved Named Entity Recognition for Low-Resource Languages Using Dependency Parsing",
      "We present a method for sentiment analysis and named entity extraction in morphologically rich languages.",
      "arxiv_cs_cl"
    );
    expect(score.showInMainFeed).toBe(false);
  });

  it("allows agent/tool-use papers into main feed", () => {
    const score = scorePaper(
      "Autonomous Agents with Tool Use for Software Engineering Tasks",
      "We introduce an agentic framework for autonomous code generation and planning with function calling.",
      "arxiv_cs_ai"
    );
    expect(score.broadRelevance).toBeGreaterThanOrEqual(40);
    // "code-generation" pattern (weight 18) beats "agent" pattern (weight 15)
    expect(["agent_tool_use", "product_relevant"]).toContain(score.inclusionReason);
  });

  it("allows safety/alignment papers into feeds", () => {
    const score = scorePaper(
      "Red-Teaming Large Language Models: New Guardrails for Alignment",
      "We investigate jailbreak vulnerabilities and propose new alignment guardrails using RLHF.",
      "arxiv_cs_ai"
    );
    expect(score.showInResearchFeed).toBe(true);
    expect(score.inclusionReason).toBe("safety_alignment");
  });

  it("penalizes heavily jargon-laden papers on accessibility", () => {
    const score = scorePaper(
      "Heteroscedastic Variational Inference with Contrastive Learning on Latent Space Manifolds",
      "We propose a bayesian approach using stochastic gradient methods for disentangled representation learning.",
      "arxiv_cs_lg"
    );
    expect(score.accessibility).toBeLessThanOrEqual(30);
  });

  it("gives HF daily papers higher prestige than raw arXiv", () => {
    const title = "New Method for Efficient Fine-tuning";
    const content = "A practical approach to LoRA-based fine-tuning for production models.";

    const hfScore = scorePaper(title, content, "hf_papers");
    const arxivScore = scorePaper(title, content, "arxiv_cs_ai");

    expect(hfScore.sourcePrestige).toBeGreaterThan(arxivScore.sourcePrestige);
  });

  it("boosts open-source ecosystem papers", () => {
    const score = scorePaper(
      "Releasing Open-Source Model Weights for Community Use",
      "We release open weights on Hugging Face model hub, available under Apache license.",
      "hf_papers"
    );
    expect(score.ecosystemImpact).toBeGreaterThanOrEqual(45);
    expect(score.inclusionReason).toBe("open_source_impact");
  });

  it("is deterministic", () => {
    const input = {
      title: "Some Research Paper on Transformers",
      content: "We study attention mechanism in transformer architectures.",
      source: "arxiv_cs_ai",
    };
    const score1 = scorePaper(input.title, input.content, input.source);
    const score2 = scorePaper(input.title, input.content, input.source);
    expect(score1).toEqual(score2);
  });

  it("clamps all scores to 0-100 range", () => {
    const score = scorePaper(
      "GPT-5 Breakthrough SOTA State-of-the-art First-ever Agent Tool-use Code-generation Multimodal Open-source Released",
      "OpenAI Google DeepMind autonomous planning function calling scaling billion parameter quantization retrieval-augmented",
      "openai_blog",
      "OpenAI"
    );
    for (const key of ["broadRelevance", "practicalRelevance", "ecosystemImpact", "accessibility", "sourcePrestige", "composite"] as const) {
      expect(score[key]).toBeGreaterThanOrEqual(0);
      expect(score[key]).toBeLessThanOrEqual(100);
    }
  });

  it("excludes very niche papers from research feed too", () => {
    const score = scorePaper(
      "Regret Bounds for Sample Complexity in PAC Learning with Markov Chains",
      "We derive convergence rate bounds for the VC dimension of heteroscedastic variational bayesian models on Hilbert manifolds.",
      "arxiv_cs_lg"
    );
    // Very niche + very jargon-heavy = very low composite
    expect(score.composite).toBeLessThan(30);
  });

  it("gives major lab papers at least research feed access", () => {
    const score = scorePaper(
      "A Niche Study of Internal Representations",
      "Google DeepMind examines latent space properties in narrow domain models.",
      "arxiv_cs_lg",
      "Google DeepMind"
    );
    expect(score.showInResearchFeed).toBe(true);
  });

  it("distinguishes product-relevant from pure theory", () => {
    const practical = scorePaper(
      "Deploying RAG at Scale with Vector Search",
      "We implement retrieval-augmented generation with embeddings for production API deployment using Docker.",
      "arxiv_cs_ai"
    );
    const theory = scorePaper(
      "On the Convergence of Stochastic Gradient Methods",
      "We study convergence rate and regret bound properties of bayesian optimization.",
      "arxiv_cs_lg"
    );
    expect(practical.practicalRelevance).toBeGreaterThan(theory.practicalRelevance);
  });

  it("handles empty content gracefully", () => {
    const score = scorePaper("Some Paper", "", "arxiv_cs_ai");
    expect(score.composite).toBeGreaterThanOrEqual(0);
    expect(score.composite).toBeLessThanOrEqual(100);
    expect(score.depth).toBeDefined();
  });

  it("handles very long titles", () => {
    const longTitle = "A ".repeat(100) + "Study of Language Models";
    const score = scorePaper(longTitle, "Some content about transformers.", "arxiv_cs_ai");
    expect(score.accessibility).toBeLessThan(60); // penalized for long title
  });

  it("correctly classifies depth tiers", () => {
    // High-value paper → general
    const general = scorePaper(
      "GPT-5 Breakthrough: State-of-the-art Reasoning",
      "OpenAI presents a major capability shift with autonomous agent planning. Open-source weights released.",
      "openai_blog",
      "OpenAI"
    );
    expect(general.depth).toBe("general");

    // Low-value niche paper → advanced
    const advanced = scorePaper(
      "Acoustic Phoneme Recognition via Speaker Diarization",
      "We study speech enhancement and speaker diarization for phoneme detection in low-resource morphological analysis.",
      "arxiv_cs_cl"
    );
    expect(advanced.depth).toBe("advanced");
  });
});

// ─── rewritePaperSummary ─────────────────────────────────────────────

describe("rewritePaperSummary", () => {
  const basePaperScore: PaperScore = {
    broadRelevance: 60,
    practicalRelevance: 50,
    ecosystemImpact: 50,
    accessibility: 60,
    sourcePrestige: 70,
    composite: 58,
    depth: "general",
    inclusionReason: "capability_shift",
    showInMainFeed: true,
    showInResearchFeed: true,
  };

  it("strips academic boilerplate from summaries", () => {
    const result = rewritePaperSummary(
      "Cool Paper",
      "In this paper, we propose a novel method for improving language models. The method achieves significant improvements on multiple benchmarks.",
      basePaperScore
    );
    expect(result.summary).not.toMatch(/^In this paper/i);
  });

  it("replaces jargon with plain English", () => {
    const result = rewritePaperSummary(
      "Efficient Training",
      "We use quantization and distillation to produce a smaller model with chain-of-thought reasoning. The retrieval-augmented generation approach improves results.",
      basePaperScore
    );
    expect(result.summary).toContain("compressing models");
    expect(result.summary).toContain("step-by-step reasoning");
  });

  it("generates whyItMatters based on inclusion reason", () => {
    const result = rewritePaperSummary("Test", "Some content.", {
      ...basePaperScore,
      inclusionReason: "safety_alignment",
    });
    expect(result.whyItMatters).toContain("safety");
  });

  it("generates whoShouldCare based on scores", () => {
    const result = rewritePaperSummary("Test", "Some content.", {
      ...basePaperScore,
      practicalRelevance: 80,
      broadRelevance: 70,
    });
    expect(result.whoShouldCare.length).toBeGreaterThan(0);
  });

  it("generates bottomLine based on composite score", () => {
    const high = rewritePaperSummary("Test", "Content.", {
      ...basePaperScore,
      composite: 75,
    });
    expect(high.bottomLine).toContain("significant");

    const low = rewritePaperSummary("Test", "Content.", {
      ...basePaperScore,
      composite: 42,
    });
    expect(low.bottomLine).toContain("Interesting");
  });

  it("caps summary length at 250 characters", () => {
    const longAbstract = "A".repeat(500) + ". " + "B".repeat(500) + ".";
    const result = rewritePaperSummary("Test", longAbstract, basePaperScore);
    expect(result.summary.length).toBeLessThanOrEqual(253); // 250 + "..."
  });

  it("handles empty abstract gracefully", () => {
    const result = rewritePaperSummary("Cool Paper", "", basePaperScore);
    expect(result.summary).toBeDefined();
    expect(result.whyItMatters.length).toBeGreaterThan(0);
  });

  it("rewrites 'We propose' boilerplate", () => {
    const result = rewritePaperSummary(
      "New Method",
      "We propose a new method for improving model performance. It achieves state-of-the-art results.",
      basePaperScore
    );
    expect(result.summary).not.toMatch(/^We propose/i);
    expect(result.summary).toContain("Introduces");
  });

  it("generates different whyItMatters per reason", () => {
    const reasons = [
      "capability_shift", "product_relevant", "open_source_impact",
      "safety_alignment", "efficiency_breakthrough", "agent_tool_use",
    ] as const;
    const messages = new Set<string>();
    for (const reason of reasons) {
      const result = rewritePaperSummary("Test", "Content.", {
        ...basePaperScore,
        inclusionReason: reason,
      });
      messages.add(result.whyItMatters);
    }
    // Each reason should produce a unique message
    expect(messages.size).toBe(reasons.length);
  });

  it("generates whoShouldCare for safety papers", () => {
    const result = rewritePaperSummary("Test", "Content.", {
      ...basePaperScore,
      practicalRelevance: 30,
      broadRelevance: 40,
      ecosystemImpact: 30,
      inclusionReason: "safety_alignment",
    });
    expect(result.whoShouldCare).toContain("safety");
  });

  it("generates whoShouldCare for open source papers", () => {
    const result = rewritePaperSummary("Test", "Content.", {
      ...basePaperScore,
      practicalRelevance: 30,
      broadRelevance: 40,
      ecosystemImpact: 30,
      inclusionReason: "open_source_impact",
    });
    expect(result.whoShouldCare).toContain("open-source");
  });
});
