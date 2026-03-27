import {
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  Code2,
  FlaskConical,
  Scale,
  Trophy,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  param: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Views",
    items: [
      { key: "latest", label: "Briefing", icon: Zap, param: "view" },
      { key: "important", label: "Most Important", icon: Trophy, param: "view" },
      { key: "research", label: "Research to Watch", icon: BookOpen, param: "view" },
    ],
  },
  {
    title: "Categories",
    items: [
      { key: "model", label: "AI Models", icon: Brain, param: "category" },
      { key: "tool", label: "AI Tools", icon: Wrench, param: "category" },
      { key: "research", label: "Research", icon: FlaskConical, param: "category" },
      { key: "company", label: "Companies & Labs", icon: Building2, param: "category" },
      { key: "opensource", label: "Open Source", icon: Code2, param: "category" },
      { key: "policy", label: "Policy & Regulation", icon: Scale, param: "category" },
      { key: "market", label: "Market & Industry", icon: BarChart3, param: "category" },
    ],
  },
];

interface SearchParamReader {
  get(name: string): string | null;
  has(name: string): boolean;
}

export function getActiveNavigationState(searchParams: SearchParamReader) {
  const activeParam = searchParams.has("category") ? "category" : "view";
  const activeKey = searchParams.get(activeParam) ?? "latest";
  const activeItem =
    navSections
      .flatMap((section) => section.items)
      .find((item) => item.param === activeParam && item.key === activeKey) ??
    navSections[0].items[0];

  return {
    activeItem,
    activeKey,
    activeParam,
  };
}
