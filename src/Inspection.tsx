import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CollectionEntry } from './collection/collection-controller';
import type { NotesController } from './notes/notes-controller';
import type { Language, Messages } from './i18n';
import { Icon } from './Icon';
import styles from './App.module.css';

function Copy({ value, m }: { value: string; m: Messages }) {
  const [status, setStatus] = useState<'copy' | 'copied' | 'copyError'>('copy');
  const revision = useRef(0);
  useEffect(() => { revision.current++; setStatus('copy'); }, [value]);
  return <button className={styles.copy} aria-label={m[status]} title={m[status]} onClick={async () => {
    const request = revision.current;
    try { await navigator.clipboard.writeText(value); if (revision.current === request) setStatus('copied'); }
    catch { if (revision.current === request) setStatus('copyError'); }
  }}><Icon name="copy" /><span className={styles.srOnly} role="status">{status === 'copy' ? '' : m[status]}</span></button>;
}

type MetadataRow = { label: string; value: string };

function Row({ label, value }: MetadataRow) {
  return <div className={styles.row}><dt>{label}</dt><dd>{value}</dd></div>;
}

function formatRow({ label, value }: MetadataRow): string {
  const text = value.replace(/\r\n?/g, '\n');
  return `${label}:${text.includes('\n') ? `\n  ${text.replace(/\n/g, '\n  ')}` : ` ${text}`}`;
}

export function NotesEditor({ entry, notes, m }: { entry: CollectionEntry; notes: NotesController; m: Messages }) {
  const state = useSyncExternalStore(notes.subscribe, notes.getSnapshot);
  useEffect(() => { void notes.select(entry.contentId); }, [notes, entry.contentId]);
  const matches = state.contentId === entry.contentId;
  const disabled = !matches || !entry.contentId || state.status === 'identity-pending' || state.status === 'loading' || state.error === 'read';
  const status = entry.identityStatus === 'error' ? m.noteIdentityError : !entry.contentId ? m.noteIdentity
    : !matches ? m.noteLoading : state.status === 'error' ? (state.error === 'read' ? m.noteReadError : m.noteWriteError)
      : ({ 'identity-pending': m.noteIdentity, loading: m.noteLoading, ready: '', dirty: m.noteDirty, saving: m.noteSaving, saved: m.noteSaved })[state.status];
  return <section className={styles.notes}>
    <label htmlFor="photo-note">{m.notes}</label>
    <textarea id="photo-note" placeholder={m.notePlaceholder} value={matches ? state.text : ''} disabled={disabled}
      aria-describedby={status ? 'note-status note-local' : 'note-local'} onChange={(event) => notes.edit(event.target.value)} onBlur={() => { void notes.flush(); }} />
    <p id="note-status" role="status" className={styles.noteStatus} hidden={!status}>{status}</p>
    <p id="note-local" className={styles.hint}>{m.noteLocal}</p>
  </section>;
}

export function Inspection({ entry, notes, m, language }: { entry: CollectionEntry; notes: NotesController; m: Messages; language: Language }) {
  const { metadata: data, provenance } = entry;
  const number = (value: number, digits = 1) => new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
  const size = entry.file.size < 1_000_000 ? `${number(entry.file.size / 1000)} kB` : `${number(entry.file.size / 1_000_000)} MB`;
  const resolution = data.width && data.height ? `${data.width} × ${data.height}${data.megapixels !== null ? ` (${number(data.megapixels)} MP)` : ''}` : null;
  const rows: MetadataRow[] = [
    { label: m.resolution, value: resolution ?? m.missing },
    { label: m.format, value: entry.format === 'image/jpeg' ? 'JPEG' : entry.format === 'image/png' ? 'PNG' : 'WebP' },
    { label: m.size, value: size },
  ];
  const metadataNotice = data.status === 'ready' ? '' : data.status === 'error' ? m.metadataError : m.metadataUnsupported;
  const provenanceStatus = m[provenance?.status ?? 'pending'];
  const provenanceRows: MetadataRow[] = provenance ? [
    { label: m.claimGenerator, value: provenance.claimGenerator ?? '' },
    { label: m.generator, value: provenance.generators.join('\n') },
    { label: m.declarations, value: provenance.aiDeclarations.join('\n') },
    { label: m.history, value: provenance.actions.join('\n') },
    { label: m.ingredients, value: provenance.ingredients.join('\n') },
  ].filter(({ value }) => value) : [];
  const copyValue = [entry.name, rows.map(formatRow).join('\n'), metadataNotice,
    [`C2PA: ${provenanceStatus}`, ...provenanceRows.map(formatRow)].join('\n'), m.provenanceNote,
  ].filter(Boolean).join('\n\n');
  return <aside className={styles.inspection} aria-label={m.information}>
    <div className={styles.filename}><h2>{entry.name}</h2><Copy value={copyValue} m={m} /></div>
    <dl className={styles.metadata}>
      {rows.map((row) => <Row key={row.label} {...row} />)}
    </dl>
    {metadataNotice && <p role="status" className={styles.hint}>{metadataNotice}</p>}
    <details className={styles.details} open>
      <summary>C2PA <Icon name="down" /></summary>
      <p role="status" className={styles.provenanceStatus} data-status={provenance?.status ?? 'pending'}>{provenanceStatus}</p>
      {provenanceRows.length > 0 && <dl className={styles.metadata}>
        {provenanceRows.map((row) => <Row key={row.label} {...row} />)}
      </dl>}
      <p className={styles.hint}>{m.provenanceNote}</p>
    </details>
    <NotesEditor entry={entry} notes={notes} m={m} />
  </aside>;
}
