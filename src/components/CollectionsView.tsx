import React from 'react';
import { ArrowRight, Scissors } from 'lucide-react';
import { INVENTORY_CATEGORIES, type InventoryCategory, type InventoryItem } from '../types/inventory';
import { aggregateKarigarsDirectory, getPriceRangeLabel } from '../utils/inventoryLogic';
import { ResilientImage } from './ResilientImage';

interface CollectionsViewProps {
  items: InventoryItem[];
  onOpenCategory: (category: InventoryCategory) => void;
  onSelectItem: (item: InventoryItem) => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  items,
  onOpenCategory,
  onSelectItem,
}) => {
  const activeItems = items.filter((i) => i.syncState !== 'pending_delete');
  const karigars = aggregateKarigarsDirectory(activeItems);

  return (
    <div className="space-y-8">
      {/* Outsourced Karigars Directory */}
      <section aria-labelledby="karigars-directory-heading" className="space-y-4">
        <div>
          <h2 id="karigars-directory-heading" className="font-display text-xl font-bold">
            Karigar Directory
          </h2>
          <p className="text-sm text-[var(--m3-on-surface-variant)]">
            Every outsourced craftsperson across cutting, katha, dyeing, and block printing with their assigned designs.
          </p>
        </div>

        {karigars.length === 0 ? (
          <div className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-6 text-sm text-[var(--m3-on-surface-variant)]">
            No Karigars logged yet. Open any design and record a Karigar handover to build your directory.
          </div>
        ) : (
          <div
            data-testid="karigar-directory-grid"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {karigars.map((entry) => (
              <div
                key={entry.karigarName}
                className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]">
                      <Scissors className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold truncate">
                        {entry.karigarName}
                      </h3>
                      <p className="text-xs text-[var(--m3-on-surface-variant)]">
                        {entry.stages.join(' · ')}
                        {entry.unitNotes.length > 0 ? ` — ${entry.unitNotes[0]}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums shrink-0">
                    <div className="font-semibold text-[var(--m3-on-surface)]">
                      {entry.designs.length} {entry.designs.length === 1 ? 'design' : 'designs'}
                    </div>
                    {entry.lastGivenCount > 0 && (
                      <div className="text-[var(--m3-primary)]">
                        Last on {entry.lastGivenCount}
                      </div>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-[var(--m3-outline-variant)] border-t border-[var(--m3-outline-variant)]">
                  {entry.designs.map(({ item, stage, dateGiven, isLastKarigar }) => (
                    <button
                      key={`${entry.karigarName}-${item.id}`}
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left hover:opacity-80"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--m3-outline-variant)]">
                          <ResilientImage
                            src={item.previewUrl || item.mediaKey}
                            alt={item.title}
                            aspectClassName="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{item.title}</p>
                          <p className="text-xs text-[var(--m3-on-surface-variant)] truncate">
                            <span className="font-mono">{item.sku}</span> · {stage}
                            {dateGiven ? ` · ${dateGiven}` : ''}
                            {isLastKarigar ? ' · Latest' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-[var(--m3-primary)] shrink-0">
                        {getPriceRangeLabel(item.sizes)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fabric & Style Collections */}
      <section aria-labelledby="categories-heading" className="space-y-4">
        <div>
          <h2 id="categories-heading" className="font-display text-xl font-bold">
            Fabric & Style Collections
          </h2>
          <p className="text-sm text-[var(--m3-on-surface-variant)]">
            Filter the garment catalogue by fabric family and silhouette.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INVENTORY_CATEGORIES.map((category) => {
            const catItems = activeItems.filter((i) => i.category === category);
            const totalUnits = catItems.reduce((sum, i) => sum + i.quantity, 0);
            const alerts = catItems.filter(
              (i) => i.status === 'low_stock' || i.status === 'out_of_stock'
            ).length;
            const leadPhoto = catItems[0]?.previewUrl || catItems[0]?.mediaKey || '';

            return (
              <button
                key={category}
                type="button"
                onClick={() => onOpenCategory(category)}
                className="group text-left overflow-hidden rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] transition-transform duration-150 hover:-translate-y-0.5 flex flex-col"
              >
                <ResilientImage
                  src={leadPhoto}
                  alt={`${category} representative garment`}
                  aspectClassName="aspect-[16/9]"
                />
                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-bold">{category}</h3>
                    <p className="mt-1 text-xs text-[var(--m3-on-surface-variant)] font-mono tabular-nums">
                      {catItems.length} designs · {totalUnits.toLocaleString('en-IN')} pcs
                      {alerts > 0 ? ` · ${alerts} low/out` : ''}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--m3-surface-container)] text-[var(--m3-on-surface)] group-hover:bg-[var(--m3-primary-container)] group-hover:text-[var(--m3-on-primary-container)] transition-colors">
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
