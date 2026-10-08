import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pickDirectory, snapshotSource, supportsDirectoryPicker } from './files/folder-source';
import { OriginalUrls } from './images/original';
import { CollectionController } from './collection/collection-controller';
import { NotesController } from './notes/notes-controller';
import { Gallery, ThumbnailStrip } from './Gallery';
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
  const [language, setLanguage] = useState<Language>(() => { const saved = storedPreference('language'); return languages.includes(saved as Language) ? saved as Language : 'pl'; });
  const [theme, setTheme] = useState(() => storedPreference('theme') === 'dark' ? 'dark' : 'light');
  const [pickerError, setPickerError] = useState<'denied' | 'folderError' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const m = messages[language];
  const active = state.entries.find((entry) => entry.entryId === state.activeId);
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
  const activate = (entryId: string) => { void controller.activate(entryId); };
  return <main className={styles.app}>
    <header className={styles.header}>
      <div className={styles.brand}><img src={logo} alt="Coding Giants" width="76" height="76" /><h1 className={styles.srOnly}>Web Album</h1></div>
      <div className={styles.modes} aria-label={m.carousel}>
        <button aria-pressed="true">{m.carousel}</button><button disabled title={m.comparisonLater}>{m.comparison}</button>
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
        onChange={(event) => { if (event.target.files?.length) { setPickerError(null); void controller.setSource(snapshotSource(Array.from(event.target.files))); } event.target.value = ''; }} />
      {state.notice === 'reselect' && <p className={styles.hint}>{m.snapshot}</p>}
      {state.scanning && active && <span role="status" className={styles.hint}>{m.scanning}</span>}
    </div>
    {active ? <>
      <div className={styles.workspace}>
        <div className={styles.galleryArea}>
          <div className={styles.collectionStatus} role="status">{status}
            {[...new Set(state.issues.map((issue) => issue.code))].map((code) => <p key={code}>{code === 'unavailable' ? m.unavailable : code === 'unsupported' ? m.unsupportedFiles : m.deniedFiles}</p>)}
          </div>
          <Gallery key={state.folderGeneration} entries={state.entries} activeId={active.entryId} activate={activate} urls={urls} m={m} />
        </div>
        <Inspection entry={active} notes={notes} m={m} language={language} />
      </div>
      <ThumbnailStrip key={state.folderGeneration} entries={state.entries} activeId={active.entryId} activate={activate} urls={urls} m={m} />
    </> : <section className={styles.empty}>
      <div className={styles.emptyIcon}><Icon name="image" /></div>
      <h2 role="status">{status || m.intro}</h2>
      {!status && <p>{m.introDetail}</p>}
      <span className={styles.hint}>{m.formats}</span>
    </section>}
  </main>;
}
