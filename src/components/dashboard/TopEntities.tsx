import { Building2, Brain, Wrench, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Entity } from "@/lib/db/schema";

const typeConfig: Record<string, { icon: LucideIcon; color: string }> = {
  company: { icon: Building2, color: "text-cat-company bg-cat-company/15" },
  lab: { icon: Building2, color: "text-cat-research bg-cat-research/15" },
  model: { icon: Brain, color: "text-cat-model bg-cat-model/15" },
  tool: { icon: Wrench, color: "text-cat-tool bg-cat-tool/15" },
  person: { icon: User, color: "text-muted-foreground bg-muted/15" },
};

export default function TopEntities({ entities }: { entities: Entity[] }) {
  if (entities.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-card/75">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <Building2 className="h-4 w-4 text-cat-company" />
        <h2 className="text-sm font-semibold text-foreground">Top Entities</h2>
        <span className="ml-auto text-[11px] text-muted">{entities.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 p-2 sm:grid-cols-2 xl:grid-cols-1">
        {entities.map((entity) => {
          const cfg = typeConfig[entity.type] ?? typeConfig.company;
          const Icon = cfg.icon;

          return (
            <div
              key={entity.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-card-hover"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {entity.name}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[11px] capitalize text-muted">{entity.type}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {entity.mentionCount ?? 0} mentions
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
