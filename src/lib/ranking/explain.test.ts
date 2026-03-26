import { describe, it, expect } from "vitest";
import { generateExplanation } from "./explain";

describe("generateExplanation", () => {
  it("generates explanation for model releases", () => {
    const result = generateExplanation({
      title: "GPT-5 Released with Major Improvements",
      content: "OpenAI has released GPT-5 with breakthrough reasoning.",
      category: "model",
      company: "OpenAI",
      importanceScore: 85,
    });
    expect(result.whatIsThis).toBeTruthy();
    expect(result.whyItMatters).toContain("Major model releases");
    expect(result.whoShouldCare).toBeTruthy();
  });

  it("generates explanation for tools", () => {
    const result = generateExplanation({
      title: "New open-source AI framework released on GitHub",
      content: "A new framework for building AI applications.",
      category: "tool",
      importanceScore: 60,
      isOpenSource: true,
    });
    expect(result.whatIsThis).toBeTruthy();
    expect(result.whyItMatters.toLowerCase()).toContain("open-source");
    expect(result.whoShouldCare).toBeTruthy();
  });

  it("generates explanation for company news", () => {
    const result = generateExplanation({
      title: "Anthropic raises $5 billion Series C",
      category: "company",
      company: "Anthropic",
      importanceScore: 75,
    });
    expect(result.whatIsThis).toContain("funding");
    expect(result.whoShouldCare.toLowerCase()).toContain("anyone tracking ai");
  });

  it("generates explanation for policy", () => {
    const result = generateExplanation({
      title: "EU passes new AI regulation bill",
      category: "policy",
      importanceScore: 70,
    });
    expect(result.whatIsThis.toLowerCase()).toContain("regulat");
    expect(result.whyItMatters.toLowerCase()).toContain("regulat");
  });

  it("generates explanation for open source", () => {
    const result = generateExplanation({
      title: "Llama 4 open weights released",
      category: "opensource",
      company: "Meta",
      importanceScore: 80,
    });
    expect(result.whatIsThis).toBeTruthy();
    expect(result.whoShouldCare.toLowerCase()).toContain("anyone tracking");
  });

  it("generates explanation for market news", () => {
    const result = generateExplanation({
      title: "AI enterprise adoption hits new record",
      category: "market",
      importanceScore: 55,
    });
    expect(result.whatIsThis).toBeTruthy();
    expect(result.whyItMatters).toContain("AI");
  });

  it("generates explanation for research", () => {
    const result = generateExplanation({
      title: "Breakthrough in AI safety alignment",
      category: "research",
      importanceScore: 75,
    });
    expect(result.whatIsThis).toBeTruthy();
    expect(result.whoShouldCare.toLowerCase()).toContain("anyone tracking");
  });

  it("handles missing fields gracefully", () => {
    const result = generateExplanation({
      title: "Some AI news",
      category: "tool",
    });
    expect(result.whatIsThis).toBeTruthy();
    expect(result.whyItMatters).toBeTruthy();
    expect(result.whoShouldCare).toBeTruthy();
  });

  it("returns different explanations for different categories", () => {
    const categories = ["model", "tool", "company", "research", "policy", "market"];
    const explanations = categories.map(cat =>
      generateExplanation({ title: "Some AI news", category: cat })
    );
    const whySet = new Set(explanations.map(e => e.whyItMatters));
    expect(whySet.size).toBeGreaterThanOrEqual(4);
  });
});
