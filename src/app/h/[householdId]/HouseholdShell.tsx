'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TabBar, Toast, type Tab } from '@/components/frostbox/inventory';
import { Icon, Mark } from '@/components/frostbox/ui';
import { VoiceSheet, type VoiceMode } from '@/components/frostbox/VoiceSheet';
import { localToday, type Draft, type InventoryItem, type Source } from '@/lib/domain';
import { apply, loadInventory, setBestBy, toActions, type Action } from '@/lib/inventory';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Change } from '@/lib/views';

type Freezer = { id: string; name: string };

type Household = {
  household: { id: string; name: string };
  freezers: Freezer[];
  freezer: Freezer;
  setFreezerId: (id: string) => void;
  items: InventoryItem[];
  inFreezer: InventoryItem[];
  today: string;
  busy: boolean;
  change: (c: Change, source?: Source) => Promise<void>;
  setPackBestBy: (lotId: string, date: string | null, label: string) => Promise<string | null>;
  openVoice: (mode: VoiceMode) => void;
};

const HouseholdContext = createContext<Household | null>(null);

export function useHousehold(): Household {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold outside HouseholdShell');
  return ctx;
}

type ToastState = { text: string; detail?: string; undo?: Action[]; error?: boolean; freezerId: string };

export function HouseholdShell({ household, freezers, initialItems, children }: {
  household: { id: string; name: string };
  freezers: Freezer[];
  initialItems: InventoryItem[];
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const pathname = usePathname();
  const [items, setItems] = useState(initialItems);
  const [freezerId, setFreezerIdState] = useState(freezers[0].id);
  const [today, setToday] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<VoiceMode | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const storageKey = `frostbox:freezer:${household.id}`;

  useEffect(() => {
    setToday(localToday());
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && freezers.some((f) => f.id === saved)) setFreezerIdState(saved);
    } catch {}
  }, [storageKey, freezers]);

  const setFreezerId = useCallback((id: string) => {
    setFreezerIdState(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch {}
  }, [storageKey]);

  const refresh = useCallback(async () => {
    setItems(await loadInventory(supabase, household.id));
  }, [supabase, household.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`movements:${household.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'movements', filter: `household_id=eq.${household.id}` }, () => void refresh())
      .subscribe();
    const onFocus = () => {
      setToday(localToday());
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [supabase, household.id, refresh]);

  const show = useCallback((t: ToastState) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), t.error ? 6000 : 5000);
  }, []);

  const run = useCallback(async (target: string, actions: Action[], source: Source) => {
    setBusy(true);
    const result = await apply(supabase, target, actions, source);
    if (!result.error) await refresh();
    setBusy(false);
    return result;
  }, [supabase, refresh]);

  const change = useCallback(async (c: Change, source: Source = 'manual') => {
    const result = await run(freezerId, c.actions, source);
    if (result.error !== null) show({ text: 'Couldn’t save that', detail: result.error, error: true, freezerId });
    else show({ text: c.text, detail: c.detail, undo: result.undo, freezerId });
  }, [run, show, freezerId]);

  const setPackBestBy = useCallback(async (lotId: string, date: string | null, label: string) => {
    setBusy(true);
    const failure = await setBestBy(supabase, lotId, date);
    if (!failure) await refresh();
    setBusy(false);
    if (!failure) show({ text: date ? `Best-by set to ${label}` : 'Best-by back to the default', freezerId });
    return failure;
  }, [supabase, refresh, show, freezerId]);

  async function undo(t: ToastState) {
    const result = await run(t.freezerId, t.undo!, 'manual');
    show(result.error !== null ? { text: 'Couldn’t undo that', detail: result.error, error: true, freezerId: t.freezerId } : { text: 'Undone', freezerId: t.freezerId });
  }

  async function saveDrafts(drafts: Draft[], source: Source) {
    const result = await run(freezerId, toActions(drafts), source);
    if (result.error !== null) return result.error;
    setVoice(null);
    show({ text: drafts.length === 1 ? 'Saved 1 change' : `Saved ${drafts.length} changes`, undo: result.undo, freezerId });
    return null;
  }

  const freezer = freezers.find((f) => f.id === freezerId) ?? freezers[0];
  const inFreezer = useMemo(() => items.filter((i) => i.freezerId === freezer.id), [items, freezer.id]);
  const base = `/h/${household.id}`;
  const tabs: Tab[] = [
    { id: 'inventory', label: 'Inventory', icon: 'freezer', href: base },
    { id: 'activity', label: 'Activity', icon: 'clock', href: `${base}/activity` },
    { id: 'households', label: 'Households', icon: 'layers', href: '/?all=1' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: `${base}/settings` },
  ];
  const active = pathname.startsWith(`${base}/activity`) ? 'activity' : pathname.startsWith(`${base}/settings`) ? 'settings' : 'inventory';

  const value: Household | null = today
    ? { household, freezers, freezer, setFreezerId, items, inFreezer, today, busy, change, setPackBestBy, openVoice: setVoice }
    : null;

  return (
    <div className="shell">
      <aside className="shell__side" aria-label="Sidebar">
        <Link href={base} className="fb-side__logo"><Mark />Frostbox</Link>
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} className="fb-side__nav" aria-current={t.id === active ? 'page' : undefined}>
            <Icon name={t.icon} size={18} />{t.label}
          </Link>
        ))}
        <label className="fb-side__freezer">
          <span className="t-overline muted">Freezer</span>
          <select className="input" value={freezer.id} onChange={(e) => setFreezerId(e.target.value)} aria-label="Freezer">
            {freezers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      </aside>

      <main className="shell__main">
        {value && <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>}
      </main>

      <div className="shell__tabs">
        <TabBar items={tabs} active={active} onVoice={() => setVoice('voice')} voiceState={voice === 'voice' ? 'listening' : busy ? 'processing' : 'idle'} />
      </div>

      {voice && today && (
        <VoiceSheet key={voice} mode={voice} items={inFreezer} today={today} onSave={saveDrafts} onClose={() => setVoice(null)} />
      )}
      {toast && <Toast text={toast.text} detail={toast.detail} tone={toast.error ? 'error' : undefined} onUndo={toast.undo?.length ? () => undo(toast) : undefined} />}
    </div>
  );
}
