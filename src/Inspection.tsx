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

function Row({ label, value, m }: { label: string; value: string | null; m: Messages }) {
  return <div className={styles.row}><dt>{label}</dt><dd><span>{value ?? m.missing}</span>{value && <Copy value={value} m={m} />}</dd></div>;
}
function Values({ label, values, m }: { label: string; values: readonly string[]; m: Messages }) {
  return values.length > 0 ? <Row label={label} value={values.join('\n')} m={m} /> : null;
}

export function NotesEditor({ entry, notes, m }: { entry: CollectionEntry; notes: NotesController; m: Messages }) {
  const state = useSyncExternalStore(notes.subscribe, notes.getSnapshot);
  useEffect(() => { void notes.select(entry.contentId); }, [notes, entry.contentId]);
  const matches = state.contentId === entry.contentId;
  const disabled = !matches || !entry.contentId || state.status === 'identity-pending' || state.status === 'loading' || state.error === 'read';
  const status = entry.identityStatus === 'error' ? m.noteIdentityError : !entry.contentId ? m.noteIdentity
    : !matches ? m.noteLoading : state.status === 'error' ? (state.error === 'read' ? m.noteReadError : m.noteWriteError)
      : ({ 'identity-pending': m.noteIdentity, loading: m.noteLoading, ready: m.noteReady, dirty: m.noteDirty, saving: m.noteSaving, saved: m.noteSaved })[state.status];
  return <section className={styles.notes}>
    <label htmlFor="photo-note">{m.notes}</label>
    <textarea id="photo-note" placeholder={m.notePlaceholder} value={matches ? state.text : ''} disabled={disabled}
      aria-describedby="note-status note-local" onChange={(event) => notes.edit(event.target.value)} onBlur={() => { void notes.flush(); }} />
    <p id="note-status" role="status" className={styles.noteStatus}>{status}</p>
    <p id="note-local" className={styles.hint}>{m.noteLocal}</p>
  </section>;
}

export function Inspection({ entry, notes, m, language }: { entry: CollectionEntry; notes: NotesController; m: Messages; language: Language }) {
  const { metadata: data, provenance } = entry;
  const number = (value: number, digits = 1) => new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
  const size = entry.file.size < 1_000_000 ? `${number(entry.file.size / 1000)} kB` : `${number(entry.file.size / 1_000_000)} MB`;
  const resolution = data.width && data.height ? `${data.width} × ${data.height}${data.megapixels !== null ? ` (${number(data.megapixels)} MP)` : ''}` : null;
  const date = data.date;
  const capture = date ? `${new Date(date.seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')}${date.fraction ? `.${date.fraction}` : ''}${date.offset ? ' UTC' : ` · ${m.noZone}`}` : null;
  return <aside className={styles.inspection} aria-label={m.information}>
    <div className={styles.filename}><h2>{entry.name}</h2><Copy value={entry.name} m={m} /></div>
    <dl className={styles.metadata}>
      <Row label={m.resolution} value={resolution} m={m} />
      <Row label={m.format} value={entry.format === 'image/jpeg' ? 'JPEG' : entry.format === 'image/png' ? 'PNG' : 'WebP'} m={m} />
      <Row label={m.size} value={size} m={m} />
      <Row label={m.date} value={capture ?? m.noDate} m={m} />
    </dl>
    {data.status !== 'ready' && <p role="status" className={styles.hint}>{data.status === 'error' ? m.metadataError : m.metadataUnsupported}</p>}
    <details className={styles.details} open>
      <summary>C2PA <Icon name="down" /></summary>
      <p role="status" className={styles.provenanceStatus} data-status={provenance?.status ?? 'pending'}>{m[provenance?.status ?? 'pending']}</p>
      {provenance && <dl className={styles.metadata}>
        <Row label={m.detection} value={m[provenance.detection]} m={m} />
        <Row label={m.completeness} value={m[provenance.completeness]} m={m} />
        {provenance.claimGenerator && <Row label={m.claimGenerator} value={provenance.claimGenerator} m={m} />}
        <Values label={m.generator} values={provenance.generators} m={m} />
        <Values label={m.declarations} values={provenance.aiDeclarations} m={m} />
        <Values label={m.history} values={provenance.actions} m={m} />
        <Values label={m.ingredients} values={provenance.ingredients} m={m} />
      </dl>}
      <p className={styles.hint}>{m.provenanceNote}</p>
    </details>
    <details className={styles.details}>
      <summary>{m.metadata}<Icon name="down" /></summary>
      <dl className={styles.metadata}>
        <Row label={m.profile} value={data.colorProfile} m={m} />
        <Row label={m.colorSpace} value={data.colorSpace} m={m} />
        {data.orientation !== null && <Row label={m.orientation} value={String(data.orientation)} m={m} />}
        {date && <Row label={m.dateSource} value={date.source.toUpperCase()} m={m} />}
        <Values label={m.software} values={data.software} m={m} />
        <Values label={m.generator} values={data.generators} m={m} />
        <Values label={m.declarations} values={data.aiDeclarations} m={m} />
        <Values label={m.history} values={data.recordedHistory} m={m} />
      </dl>
      <p className={styles.hint}>{m.colorNote}</p>
    </details>
    <NotesEditor entry={entry} notes={notes} m={m} />
  </aside>;
}
