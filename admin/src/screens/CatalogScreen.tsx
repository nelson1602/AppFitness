import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Banner } from '../components/Banner';
import { es } from '../i18n/es';
import type { CatalogNotice, NotifyFn } from './catalog/catalogFormat';
import { ExerciseList } from './catalog/ExerciseList';
import { FoodDetail } from './catalog/FoodDetail';
import { FoodList } from './catalog/FoodList';

const TABS = ['foods', 'exercises'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  foods: es.catalog.foodsTab,
  exercises: es.catalog.exercisesTab,
};

const tabId = (tab: Tab) => `catalog-tab-${tab}`;
const panelId = (tab: Tab) => `catalog-panel-${tab}`;

/** `#/catalogo` (food and exercise lists) and `#/catalogo/:foodId`. */
export function CatalogScreen({ foodId }: { foodId?: string }) {
  const [tab, setTab] = useState<Tab>('foods');
  // A banner only shows on the view it was raised for.
  const [notice, setNotice] = useState<CatalogNotice | null>(null);
  const onNotice: NotifyFn = (at, message) => setNotice({ at, message });
  const current = foodId ?? null;
  const message = notice && notice.at === current ? notice.message : null;

  if (foodId) {
    return (
      <FoodDetail
        key={foodId}
        foodId={foodId}
        notice={message}
        onNotice={onNotice}
        onDismissNotice={() => setNotice(null)}
      />
    );
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const index = (TABS.indexOf(tab) + step + TABS.length) % TABS.length;
    const next = TABS[index] ?? 'foods';
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <section aria-labelledby="catalog-title">
      <h1 id="catalog-title">{es.catalog.title}</h1>
      <Banner message={message} onDismiss={() => setNotice(null)} />
      <div className="tabs" role="tablist" aria-label={es.catalog.tabsLabel}>
        {TABS.map((value) => (
          <button
            key={value}
            id={tabId(value)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === value}
            aria-controls={panelId(value)}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={onTabKeyDown}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>
      <div
        id={panelId(tab)}
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        className="tab-panel"
      >
        {tab === 'foods' ? <FoodList onNotice={onNotice} /> : <ExerciseList />}
      </div>
    </section>
  );
}
