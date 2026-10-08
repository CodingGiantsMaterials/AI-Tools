import { memo, useEffect, useRef, useState } from 'react';
import type { CollectionEntry } from './collection/collection-controller';
import type { OriginalUrls } from './images/original';
import type { Messages } from './i18n';
import { Icon } from './Icon';
import styles from './App.module.css';

export function carouselOffset(index: number, active: number, length: number): number {
  const forward = (index - active + length) % length;
  return forward > length / 2 ? forward - length : forward;
}

/** Native originals stay mounted while the same revision moves between positions. */
export const OriginalImage = memo(function OriginalImage({ entry, urls, error }: { entry: CollectionEntry; urls: OriginalUrls; error: string }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const lease = urls.acquire(entry.resourceKey, entry.file);
    setUrl(lease.url); setFailed(false);
    return lease.release;
  }, [entry.resourceKey, entry.file, urls]);
  return <>{url && <img src={url} alt={entry.name} draggable={false} onError={() => setFailed(true)} />}
    {failed && <span className={styles.imageError}>{error}</span>}</>;
});

function PreviewDialog({ entry, urls, m, onClose, opener }: { entry: CollectionEntry; urls: OriginalUrls; m: Messages; onClose: () => void; opener: HTMLElement }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal(); close.current?.focus();
    return () => {
      element.close();
      const target = opener.isConnected ? opener : document.querySelector<HTMLElement>('button[data-position="0"], button[data-folder-control]');
      target?.focus({ preventScroll: true });
    };
  }, [opener]);
  return <dialog ref={dialog} className={styles.modal} aria-label={m.preview} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => { if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); } }}>
    <div className={styles.modalHeader}><span>{entry.name}</span><button ref={close} aria-label={m.close} title={m.close} onClick={onClose}><Icon name="close" /></button></div>
    <div className={styles.modalImage}><OriginalImage key={entry.resourceKey} entry={entry} urls={urls} error={m.imageError} /></div>
  </dialog>;
}

interface GalleryProps { entries: readonly CollectionEntry[]; activeId: string; activate: (entryId: string) => void; urls: OriginalUrls; m: Messages }
export function Gallery({ entries, activeId, activate, urls, m }: GalleryProps) {
  const activeIndex = entries.findIndex((entry) => entry.entryId === activeId);
  const [modal, setModal] = useState<{ entryId: string; opener: HTMLElement } | null>(null);
  const modalEntry = modal && entries.find((entry) => entry.entryId === modal.entryId);
  useEffect(() => { if (modal && !modalEntry) setModal(null); }, [modal, modalEntry]);
  const move = (direction: number) => {
    const next = entries[(activeIndex + direction + entries.length) % entries.length];
    if (next && entries.length > 1) activate(next.entryId);
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (modal || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        document.querySelector('dialog[open], [role="dialog"], [role="listbox"]') ||
        target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [data-shortcuts="off"]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  return <>
    <section className={styles.carousel} aria-label={m.carousel}>
      {entries.map((entry, index) => ({ entry, offset: carouselOffset(index, activeIndex, entries.length) }))
        .filter(({ offset }) => Math.abs(offset) <= 3).map(({ entry, offset }) =>
          <button key={entry.resourceKey} className={styles.card} data-position={offset} data-entry-id={entry.entryId}
            aria-label={`${offset === 0 ? m.enlarge : m.select}: ${entry.name}`} aria-hidden={Math.abs(offset) > 2} tabIndex={Math.abs(offset) > 2 ? -1 : 0}
            onClick={(event) => { if (offset === 0) setModal({ entryId: entry.entryId, opener: event.currentTarget }); else activate(entry.entryId); }}>
            <OriginalImage entry={entry} urls={urls} error={m.imageError} />
          </button>)}
      <button className={`${styles.arrow} ${styles.previous}`} aria-label={m.previous} title={m.previous} disabled={entries.length < 2} onClick={() => move(-1)}><Icon name="left" /></button>
      <button className={`${styles.arrow} ${styles.next}`} aria-label={m.next} title={m.next} disabled={entries.length < 2} onClick={() => move(1)}><Icon name="right" /></button>
    </section>
    {modal && modalEntry && <PreviewDialog entry={modalEntry} opener={modal.opener} urls={urls} m={m} onClose={() => setModal(null)} />}
  </>;
}

/** Only viewport images plus a dimension-budgeted overscan acquire original URLs. */
export function ThumbnailStrip({ entries, activeId, activate, urls, m }: GalleryProps) {
  const strip = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<Set<string>>(() => new Set());
  // Visible originals are required; a 96 MP soft budget controls optional overscan.
  // Unknown dimensions conservatively assume 24 MP (~96 MB for one RGBA buffer).
  const largestPixels = Math.max(1, ...entries.map(({ metadata }) => (metadata.width ?? 6000) * (metadata.height ?? 4000)));
  const overscan = largestPixels * 12 > 96_000_000 ? 0 : 120;
  const structure = entries.map((entry) => entry.resourceKey).join('|');
  useEffect(() => {
    const root = strip.current!;
    setVisible(new Set());
    const observer = new IntersectionObserver((changes) => {
      setVisible((previous) => {
        const next = new Set(previous);
        for (const item of changes) {
          const key = (item.target as HTMLElement).dataset.resourceKey!;
          if (item.isIntersecting) next.add(key); else next.delete(key);
        }
        return next;
      });
    }, { root, rootMargin: `0px ${overscan}px`, threshold: 0 });
    for (const child of root.children) observer.observe(child);
    return () => observer.disconnect();
  }, [structure, overscan]);
  useEffect(() => {
    const root = strip.current!;
    const reveal = () => {
      const current = root.querySelector<HTMLElement>('[aria-current="true"]');
      if (!current) return;
      const left = current.offsetLeft;
      if (left < root.scrollLeft || left + current.offsetWidth > root.scrollLeft + root.clientWidth) {
        root.scrollTo({ left: left - (root.clientWidth - current.offsetWidth) / 2, behavior: 'instant' });
      }
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeId, structure]);
  return <nav className={styles.thumbnails} aria-label={m.thumbnails}>
    <button className={styles.stripArrow} aria-label={m.scrollBack} title={m.scrollBack} disabled={entries.length < 2} onClick={() => strip.current?.scrollBy({ left: -strip.current.clientWidth * .7, behavior: 'smooth' })}><Icon name="left" /></button>
    <div ref={strip} className={styles.strip}>
      {entries.map((entry) => <button key={entry.resourceKey} data-resource-key={entry.resourceKey} className={styles.thumbnail}
        aria-current={entry.entryId === activeId ? 'true' : undefined} aria-label={`${m.select}: ${entry.name}`} title={entry.name}
        onClick={() => activate(entry.entryId)}>
        {visible.has(entry.resourceKey) ? <OriginalImage entry={entry} urls={urls} error={m.imageError} /> : <Icon name="image" />}
      </button>)}
    </div>
    <button className={styles.stripArrow} aria-label={m.scrollNext} title={m.scrollNext} disabled={entries.length < 2} onClick={() => strip.current?.scrollBy({ left: strip.current.clientWidth * .7, behavior: 'smooth' })}><Icon name="right" /></button>
  </nav>;
}
