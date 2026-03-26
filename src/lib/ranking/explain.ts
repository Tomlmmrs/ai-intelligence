/**
 * "Why this matters" generator for ALL item types.
 *
 * Produces a short, structured explanation:
 *   - What is this? (1 sentence)
 *   - Why it matters (1-2 sentences)
 *   - Who should care (1 line)
 *
 * Max 3-4 sentences total. Plain English only.
 */

import type { Category } from "../types";

export interface WhyExplanation {
  whatIsThis: string;
  whyItMatters: string;
  whoShouldCare: string;
}

// ─── Category-specific "what is this" templates ──────────────────────

const WHAT_TEMPLATES: Record<string, (title: string, company: string | null) => string> = {
  model: (title, company) => {
    const who = company ? `${company} has` : "A team has";
    if (/releas|launch|announc|introduc/i.test(title)) {
      return `${who} released a new AI model that could change how developers build AI-powered products.`;
    }
    if (/update|improv|upgrad|v\d/i.test(title)) {
      return `${who} updated an AI model with new capabilities or improved performance.`;
    }
    if (/benchmark|evaluat|compar/i.test(title)) {
      return `New benchmarks show how the latest AI models stack up against each other.`;
    }
    return `${who} announced a new AI model or significant model improvement.`;
  },
  tool: (title, company) => {
    const who = company ? company : "A developer team";
    if (/open.?source|released|github/i.test(title)) {
      return `${who} has open-sourced a new AI tool that developers can use today.`;
    }
    if (/api|sdk|library|framework/i.test(title)) {
      return `${who} has released a new developer tool for building AI applications.`;
    }
    if (/plugin|extension|integrat/i.test(title)) {
      return `A new integration that connects AI capabilities to existing tools and workflows.`;
    }
    return `A new AI tool or platform that could be useful for builders and practitioners.`;
  },
  company: (title, company) => {
    const who = company ?? "An AI company";
    if (/funding|raised|series|valuation/i.test(title)) {
      return `${who} has raised new funding, signaling investor confidence in their AI approach.`;
    }
    if (/acqui|merger|partner/i.test(title)) {
      return `${who} is making a strategic move that could reshape the AI landscape.`;
    }
    if (/hire|team|ceo|leadership/i.test(title)) {
      return `${who} is making key leadership changes that could shift their AI direction.`;
    }
    return `${who} is making moves that could affect the broader AI industry.`;
  },
  opensource: (title, company) => {
    if (/star|trending|popular/i.test(title)) {
      return `An open-source AI project is gaining rapid traction in the developer community.`;
    }
    if (/release|launch|v\d/i.test(title)) {
      return `A new open-source AI release that gives developers free access to advanced capabilities.`;
    }
    return `An open-source AI development that expands what's freely available to builders.`;
  },
  policy: (title) => {
    if (/regulat|law|legislat|ban|restrict/i.test(title)) {
      return `New regulations or legislation that could change how AI companies operate.`;
    }
    if (/safety|alignment|risk|ethics/i.test(title)) {
      return `New developments in AI safety or governance that could affect the industry.`;
    }
    return `An AI policy development that could shape how AI is built and deployed.`;
  },
  market: (title) => {
    if (/revenue|growth|earnings|profit/i.test(title)) {
      return `New market data showing how AI is performing as a business sector.`;
    }
    if (/adoption|enterprise|deploy/i.test(title)) {
      return `New signals about how organizations are actually using AI in practice.`;
    }
    return `A market development that reveals where AI is heading commercially.`;
  },
  research: (title, company) => {
    const who = company ? `Researchers at ${company}` : "Researchers";
    if (/breakthrough|first|state.of.the.art|sota/i.test(title)) {
      return `${who} have achieved a significant technical breakthrough that could shape future AI systems.`;
    }
    if (/safety|alignment|harm|bias/i.test(title)) {
      return `${who} have published important findings about making AI systems safer and more reliable.`;
    }
    if (/agent|tool.use|autonom/i.test(title)) {
      return `${who} have advanced how AI systems can act independently and use tools.`;
    }
    return `${who} have published findings that could influence the next generation of AI systems.`;
  },
};

// ─── Category-specific "why it matters" ──────────────────────────────

function generateWhyItMatters(
  title: string,
  content: string,
  category: Category,
  company: string | null,
  importanceScore: number,
  isOpenSource: boolean,
): string {
  const text = `${title} ${content}`.toLowerCase();

  // Check for specific high-impact signals
  if (/gpt[-\s]?[4-9]|claude[-\s]?[3-9]|gemini[-\s]?[2-9]|llama[-\s]?[3-9]/i.test(title)) {
    return "Major model releases from leading labs set the pace for the entire AI industry and immediately affect what developers can build.";
  }

  if (category === "model") {
    if (/open.?source|open.?weight/i.test(text)) {
      return "Open-weight models give developers direct access to powerful AI without API dependencies, enabling new products and research.";
    }
    if (importanceScore >= 70) {
      return "This could shift what's possible in AI applications and influence how products are built in the coming months.";
    }
    return "New model capabilities expand what developers and companies can build with AI.";
  }

  if (category === "tool") {
    if (isOpenSource) {
      return "Open-source AI tools accelerate development for everyone and often become industry standards.";
    }
    if (/api|platform|service/i.test(text)) {
      return "New AI platforms and APIs directly affect what products teams can ship and how quickly they can move.";
    }
    return "New tools and frameworks change how AI practitioners work day-to-day.";
  }

  if (category === "company") {
    if (/billion|major|massive/i.test(text)) {
      return "Large-scale industry moves signal where the AI market is heading and which approaches are gaining momentum.";
    }
    return "Company moves in AI reveal which strategies and technologies are gaining real traction.";
  }

  if (category === "opensource") {
    return "Open-source momentum shows what the community values and often predicts which tools will become dominant.";
  }

  if (category === "policy") {
    return "AI regulation and policy directly shape what companies can build and how AI products reach users worldwide.";
  }

  if (category === "market") {
    return "Market signals reveal where real money and adoption are flowing in AI, beyond the hype.";
  }

  if (category === "research") {
    if (importanceScore >= 70) {
      return "High-impact research like this often leads to new products and capabilities within months, not years.";
    }
    return "This research could influence how future AI systems are designed and what they can do.";
  }

  return "This development is part of the rapidly evolving AI landscape.";
}

// ─── "Who should care" ───────────────────────────────────────────────

function generateWhoShouldCare(
  category: Category,
  importanceScore: number,
  isOpenSource: boolean,
): string {
  const audiences: string[] = [];

  if (importanceScore >= 70) {
    audiences.push("anyone tracking AI progress");
  }

  switch (category) {
    case "model":
      audiences.push("AI engineers", "product teams");
      if (isOpenSource) audiences.push("the open-source community");
      break;
    case "tool":
      audiences.push("developers", "AI builders");
      break;
    case "company":
      audiences.push("industry observers", "investors");
      break;
    case "opensource":
      audiences.push("developers", "the open-source community");
      break;
    case "policy":
      audiences.push("AI companies", "compliance teams", "policymakers");
      break;
    case "market":
      audiences.push("investors", "business leaders", "startup founders");
      break;
    case "research":
      audiences.push("AI researchers", "ML engineers");
      if (importanceScore >= 60) audiences.push("product teams");
      break;
  }

  // Deduplicate and limit
  const unique = [...new Set(audiences)].slice(0, 3);
  return unique.length > 0
    ? unique[0].charAt(0).toUpperCase() + unique.slice(0).join(", ").slice(1)
    : "AI practitioners and industry observers";
}

// ─── Main generation function ────────────────────────────────────────

export function generateExplanation(item: {
  title: string;
  content?: string | null;
  category: string;
  company?: string | null;
  importanceScore?: number | null;
  isOpenSource?: boolean | null;
}): WhyExplanation {
  const category = item.category as Category;
  const company = item.company ?? null;
  const content = item.content ?? "";
  const importance = item.importanceScore ?? 50;
  const isOpenSource = item.isOpenSource ?? false;

  const whatFn = WHAT_TEMPLATES[category] ?? WHAT_TEMPLATES.tool;
  const whatIsThis = whatFn(item.title, company);

  const whyItMatters = generateWhyItMatters(
    item.title,
    content,
    category,
    company,
    importance,
    isOpenSource,
  );

  const whoShouldCare = generateWhoShouldCare(category, importance, isOpenSource);

  return { whatIsThis, whyItMatters, whoShouldCare };
}
