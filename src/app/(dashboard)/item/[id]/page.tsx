import { getItemById, getItemsByCluster, getAlerts, getDashboardStats } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import ItemCard from "@/components/items/ItemCard";
import {
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  Zap,
  Shield,
  Target,
  Wrench,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ScoreBar({ label, score, icon: Icon, color }: { label: string; score: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="w-24 text-sm text-muted">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border">
        <div
          className={`h-full rounded-full score-bar ${color.replace("text-", "bg-")}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-mono text-foreground">{Math.round(score)}</span>
    </div>
  );
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemById(id);
  if (!item) notFound();

  const [stats, alerts] = await Promise.all([
    getDashboardStats(),
    getAlerts(false, 10),
  ]);
  const relatedItems = item.clusterId
    ? (await getItemsByCluster(item.clusterId)).filter(i => i.id !== item.id)
    : [];

  const tags: string[] = item.tags ? JSON.parse(item.tags) : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header unreadCount={stats.unreadAlerts} />
      <div className="flex flex-1 pt-14">
        <Sidebar />
        <main className="flex-1 overflow-auto pl-60">
          <div className="mx-auto max-w-4xl px-6 py-6">
            {/* Back nav */}
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>

            {/* Header */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded-full bg-cat-model/20 px-3 py-0.5 text-xs font-medium text-cat-model">
                      {item.category}
                    </span>
                    <span className="text-xs text-muted">{item.source}</span>
                    {item.isOpenSource && (
                      <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                        Open Source
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-foreground leading-tight">{item.title}</h1>
                  {item.company && (
                    <p className="mt-2 text-sm text-muted">{item.company}</p>
                  )}
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground hover:border-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Source
                </a>
              </div>

              {/* Scores */}
              <div className="mt-6 space-y-2.5">
                <ScoreBar label="Importance" score={item.importanceScore ?? 50} icon={Zap} color="text-warning" />
                <ScoreBar label="Novelty" score={item.noveltyScore ?? 50} icon={TrendingUp} color="text-accent" />
                <ScoreBar label="Impact" score={item.impactScore ?? 50} icon={Target} color="text-critical" />
                <ScoreBar label="Credibility" score={item.credibilityScore ?? 50} icon={Shield} color="text-success" />
                <ScoreBar label="Practical" score={item.practicalScore ?? 50} icon={Wrench} color="text-cat-tool" />
              </div>
            </div>

            {/* Summary */}
            {(item.aiSummary || item.summary) && (
              <div className="mt-4 rounded-xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Summary</h2>
                <p className="text-foreground leading-relaxed">{item.aiSummary || item.summary}</p>
              </div>
            )}

            {/* Intelligence Analysis */}
            {(item.whyItMatters || item.whoShouldCare || item.implications) && (
              <div className="mt-4 rounded-xl border border-border bg-card p-6 space-y-4">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Intelligence Analysis</h2>
                {item.whyItMatters && (
                  <div>
                    <h3 className="text-sm font-medium text-accent mb-1">Why It Matters</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.whyItMatters}</p>
                  </div>
                )}
                {item.whoShouldCare && (
                  <div>
                    <h3 className="text-sm font-medium text-accent mb-1">Who Should Care</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.whoShouldCare}</p>
                  </div>
                )}
                {item.implications && (
                  <div>
                    <h3 className="text-sm font-medium text-accent mb-1">Implications</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.implications}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Related Items */}
            {relatedItems.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-muted uppercase tracking-wide">Related Coverage</h2>
                <div className="space-y-3">
                  {relatedItems.map((related) => (
                    <ItemCard key={related.id} item={related} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
