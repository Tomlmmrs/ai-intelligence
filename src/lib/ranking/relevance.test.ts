import { describe, it, expect } from "vitest";
import { scoreRealWorldRelevance, assignItemLabel, assignImpactTag } from "./relevance";

describe("scoreRealWorldRelevance", () => {
  it("gives high relevance to tool/product releases", () => {
    const score = scoreRealWorldRelevance(
      "New API SDK released for developers",
      "Deploy AI models with our new SDK. Available on npm.",
      "tool", "techcrunch_ai", 70, false
    );
    expect(score).toBeGreaterThanOrEqual(75);
  });

  it("gives high relevance to model releases", () => {
    const score = scoreRealWorldRelevance(
      "GPT-5 launched with new capabilities",
      "OpenAI releases GPT-5, available via API today.",
      "model", "openai_blog", 85, false
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("gives low relevance to pure academic research", () => {
    const score = scoreRealWorldRelevance(
      "On the Convergence of Stochastic Gradient Methods",
      "We prove a theorem about convergence rate bounds. In this paper we propose a novel approach.",
      "research", "arxiv_cs_lg", 40, false
    );
    expect(score).toBeLessThanOrEqual(25);
  });

  it("gives moderate relevance to product-relevant research", () => {
    const score = scoreRealWorldRelevance(
      "RAG at Scale: Retrieval-Augmented Generation for Production",
      "We deploy retrieval-augmented generation with vector search API for enterprise use.",
      "research", "arxiv_cs_ai", 60, false
    );
    expect(score).toBeGreaterThan(30);
  });

  it("boosts open-source items", () => {
    const closed = scoreRealWorldRelevance(
      "New AI framework",
      "A framework for AI.",
      "tool", "news", 50, false
    );
    const open = scoreRealWorldRelevance(
      "New AI framework",
      "A framework for AI.",
      "tool", "news", 50, true
    );
    expect(open).toBeGreaterThan(closed);
  });

  it("penalizes arXiv source", () => {
    const blog = scoreRealWorldRelevance(
      "New method for fine-tuning",
      "LoRA-based approach.",
      "model", "openai_blog", 50, false
    );
    const arxiv = scoreRealWorldRelevance(
      "New method for fine-tuning",
      "LoRA-based approach.",
      "model", "arxiv_cs_ai", 50, false
    );
    expect(blog).toBeGreaterThan(arxiv);
  });

  it("clamps to 0-100 range", () => {
    const high = scoreRealWorldRelevance(
      "Released launched API SDK open-source GPT agent multimodal",
      "deploy production enterprise billion partnership github",
      "tool", "openai_blog", 90, true
    );
    expect(high).toBeLessThanOrEqual(100);
    expect(high).toBeGreaterThanOrEqual(0);

    const low = scoreRealWorldRelevance(
      "Convergence theorem proof lemma regret bound",
      "We propose a novel approach in this paper. Survey taxonomy ablation.",
      "research", "arxiv_cs_lg", 20, false
    );
    expect(low).toBeLessThanOrEqual(100);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe("assignItemLabel", () => {
  it("assigns Model Release for model launches", () => {
    expect(assignItemLabel("GPT-5 Released Today", "model", false)).toBe("Model Release");
  });

  it("assigns Model Update for version bumps", () => {
    expect(assignItemLabel("Claude v3.5 Update with improvements", "model", false)).toBe("Model Update");
  });

  it("assigns New Tool for tool items", () => {
    expect(assignItemLabel("A new AI development platform", "tool", false)).toBe("New Tool");
  });

  it("assigns API Update for API items", () => {
    expect(assignItemLabel("New API endpoints for developers", "tool", false)).toBe("API Update");
  });

  it("assigns Open Source Tool for OSS tools", () => {
    expect(assignItemLabel("A new AI development platform", "tool", true)).toBe("Open Source Tool");
  });

  it("assigns Funding for company funding", () => {
    expect(assignItemLabel("AI startup raises $100M Series B", "company", false)).toBe("Funding");
  });

  it("assigns Research for research items", () => {
    expect(assignItemLabel("A study of language models", "research", false)).toBe("Research");
  });

  it("assigns Safety Research for safety papers", () => {
    expect(assignItemLabel("New findings in AI alignment and safety", "research", false)).toBe("Safety Research");
  });
});

describe("assignImpactTag", () => {
  it("assigns High Impact for high scores", () => {
    expect(assignImpactTag(80, 85, 60, 90)).toBe("High Impact");
  });

  it("assigns Worth Watching for moderate scores", () => {
    expect(assignImpactTag(65, 60, 50, 70)).toBe("Worth Watching");
  });

  it("assigns Early Signal for high novelty", () => {
    expect(assignImpactTag(40, 45, 80, 50)).toBe("Early Signal");
  });

  it("assigns Experimental for low-relevance advanced content", () => {
    expect(assignImpactTag(30, 25, 40, 20, "advanced")).toBe("Experimental");
  });

  it("returns null for average content", () => {
    expect(assignImpactTag(50, 50, 50, 50)).toBeNull();
  });
});
