import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pickDirectory, snapshotSource, supportsDirectoryPicker } from './files/folder-source';
import { OriginalUrls } from './images/original';
import { CollectionController } from './collection/collection-controller';
import { NotesController } from './notes/notes-controller';
import { Gallery, ThumbnailStrip } from './Gallery';
import { Comparison } from './Comparison';
import { assignComparison, createComparison, pinComparison, reconcileComparison, type Slot } from './comparison-state';
import { Inspection } from './Inspection';
import { Icon } from './Icon';
import { languages, messages, savePreference, storedPreference, type Language } from './i18n';
import logo from './assets/coding-giants-small-logo.png';
import styles from './App.module.css';

export function App() {
  const [controller] = useState(() => new CollectionController());
  const [urls] = useState(() => new OriginalUrls());
  const [notes] = useState(() => new NotesController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [mode, setMode] = useState<'carousel' | 'comparison'>('carousel');
  const [storedComparison, setComparison] = useState(() => createComparison(state.folderGeneration, state.entries, state.activeId));
  const comparison = reconcileComparison(storedComparison, state.folderGeneration, state.entries, state.activeId);
  if (comparison !== storedComparison) setComparison(comparison);
  const [language, setLanguage] = useState<Language>(() => { const saved = storedPreference('language'); return languages.includes(saved as Language) ? saved as Language : 'pl'; });
  const [theme, setTheme] = useState(() => storedPreference('theme') === 'dark' ? 'dark' : 'light');
  const [pickerError, setPickerError] = useState<'denied' | 'folderError' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const m = messages[language];
  const activeId = mode === 'comparison' ? comparison.slots[comparison.active]?.entryId ?? null : state.activeId;
  const active = state.entries.find((entry) => entry.entryId === activeId);
  useEffect(() => {
    if (mode === 'comparison' && active && state.activeId !== active.entryId) void controller.activate(active.entryId);
  }, [mode, active, state.activeId, controller]);
  useEffect(() => { document.documentElement.lang = language; savePreference('language', language); }, [language]);
  useEffect(() => { document.documentElement.dataset.theme = theme; savePreference('theme', theme); }, [theme]);
  useEffect(() => {
    const flush = () => { void notes.flushAll(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); void controller.dispose(); void notes.dispose(); urls.dispose(); };
  }, [controller, notes, urls]);
  useEffect(() => { if (!active) void notes.select(null); }, [active, notes]);

  async function choose() {
    if (!supportsDirectoryPicker()) { input.current?.click(); return; }
    try { const source = await pickDirectory(); setPickerError(null); await controller.setSource(source); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setPickerError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'folderError');
    }
  }
  const status = pickerError ? m[pickerError] : state.status === 'error' ? m.folderError : state.status === 'access-denied' ? m.denied
    : state.status === 'loading' ? m.loading : state.status === 'empty' ? m.empty : state.status === 'no-supported' ? m.noSupported : '';
  const activate = (entryId: string) => {
    if (mode === 'comparison') {
      const entry = state.entries.find((item) => item.entryId === entryId);
      if (entry) setComparison((current) => assignComparison(current, entry));
    }
    void controller.activate(entryId);
  };
  const changeMode = (next: typeof mode) => {
    if (next === mode) return;
    if (next === 'comparison' && active) setComparison(assignComparison(comparison, active));
    if (next === 'carousel' && active) void controller.activate(active.entryId);
    setMode(next);
  };
  const selectSlot = (slot: Slot) => {
    setComparison({ ...comparison, active: slot });
    const id = comparison.slots[slot]?.entryId;
    if (id) void controller.activate(id);
  };
  return <main className={styles.app}>
    <header className={styles.header}>
      <div className={styles.brand}><img src={logo} alt="Coding Giants" width="76" height="76" /><h1 className={styles.srOnly}>Web Album</h1></div>
      <div className={styles.modes} role="group" aria-label={m.view}>
        <button aria-pressed={mode === 'carousel'} onClick={() => changeMode('carousel')}>{m.carousel}</button><button aria-pressed={mode === 'comparison'} onClick={() => changeMode('comparison')}>{m.comparison}</button>
      </div>
      <div className={styles.preferences} data-shortcuts="off">
        <select aria-label={m.language} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
          <option value="pl" lang="pl" label="PL">Polski</option><option value="en" lang="en" label="EN">English</option>
          <option value="de" lang="de" label="DE">Deutsch</option><option value="es" lang="es" label="ES">Español</option>
        </select>
        <div className={styles.theme} role="group" aria-label={m.theme}>
          <button aria-label={m.light} title={m.light} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" /></button>
          <button aria-label={m.dark} title={m.dark} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Icon name="moon" /></button>
        </div>
      </div>
    </header>
    <div className={styles.controls}>
      <button data-folder-control onClick={() => void choose()}><Icon name="folder" />{state.status === 'no-folder' ? m.choose : m.change}</button>
      {state.canRefresh && <button disabled={state.scanning} onClick={() => { setPickerError(null); void controller.refresh(); }}><Icon name="refresh" />{m.refresh}</button>}
      <input ref={input} type="file" multiple {...{ webkitdirectory: '' }} hidden aria-label={m.choose}
        onChange={(event) => { if (event.target.files) { setPickerError(null); void controller.setSource(snapshotSource(Array.from(event.target.files))); } event.target.value = ''; }} />
      {state.notice === 'reselect' && <p className={styles.hint}>{m.snapshot}</p>}
      {state.scanning && active && <span role="status" className={styles.hint}>{m.scanning}</span>}
    </div>
    {active || mode === 'comparison' && state.folderGeneration > 0 ? <>
      <div className={styles.workspace}>
        <div className={styles.galleryArea}>
          <div className={styles.collectionStatus} role="status">{status}
            {[...new Set(state.issues.map((issue) => issue.code))].map((code) => <p key={code}>{code === 'unavailable' ? m.unavailable : code === 'unsupported' ? m.unsupportedFiles : m.deniedFiles}</p>)}
          </div>
          {mode === 'carousel' ? <Gallery key={state.folderGeneration} entries={state.entries} activeId={activeId} activate={activate} urls={urls} m={m} />
            : <Comparison state={comparison} entries={state.entries} urls={urls} m={m} select={selectSlot} assign={activate} pin={(slot) => setComparison(pinComparison(comparison, slot))} />}
        </div>
        {active ? <Inspection entry={active} notes={notes} m={m} language={language} /> : <aside className={styles.inspection} aria-label={m.information}>
          <h2>{m.field} {comparison.active}</h2><p role="status">{comparison.slots[comparison.active] ? m.pinnedUnavailable : m.comparisonEmpty}</p>
        </aside>}
      </div>
      <ThumbnailStrip key={state.folderGeneration} entries={state.entries} activeId={active?.entryId ?? null} activate={activate} urls={urls} m={m} />
    </> : <section className={styles.empty}>
      <div className={styles.emptyIcon}><Icon name="image" /></div>
      <h2 role="status">{status || m.intro}</h2>
      {!status && <p>{m.introDetail}</p>}
      <span className={styles.hint}>{m.formats}</span>
    </section>}
  </main>;
}
