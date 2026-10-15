import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Header, useDocumentPreferences, type Theme } from '@ai-tools/shared/header';
import { isLanguage, type Language } from '@ai-tools/shared/i18n';
import { Icon } from '@ai-tools/shared/icon';
import { ObjectUrls } from '@ai-tools/shared/object-urls';
import { savePreference, storedPreference } from '@ai-tools/shared/preferences';
import { directorySource, pickDirectoryHandle, snapshotSource, supportsDirectoryPicker, type ReadOnlyDirectoryHandle } from './files/folder-source';
import { clearHandle, loadHandle, saveHandle } from './files/folder-repository';
import { CollectionController } from './collection/collection-controller';
import { NotesController } from './notes/notes-controller';
import { Gallery, ThumbnailStrip } from './Gallery';
import { Inspection } from './Inspection';
import { messages } from './i18n';
import styles from './App.module.css';

const preferencePrefix = 'ai-tools-album';

export function App() {
  const [controller] = useState(() => new CollectionController());
  const [urls] = useState(() => new ObjectUrls());
  const [notes] = useState(() => new NotesController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [language, setLanguage] = useState<Language>(() => { const saved = storedPreference(preferencePrefix, 'language'); return isLanguage(saved) ? saved : 'pl'; });
  const [theme, setTheme] = useState<Theme>(() => storedPreference(preferencePrefix, 'theme') === 'dark' ? 'dark' : 'light');
  const [pickerError, setPickerError] = useState<'denied' | 'folderError' | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ReadOnlyDirectoryHandle | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const m = messages[language];
  const active = state.entries.find((entry) => entry.entryId === state.activeId);
  useDocumentPreferences(language, theme);
  useEffect(() => { savePreference(preferencePrefix, 'language', language); }, [language]);
  useEffect(() => { savePreference(preferencePrefix, 'theme', theme); }, [theme]);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const handle = await loadHandle();
        if (!mounted || !handle || controller.getSnapshot().status !== 'no-folder') return;
        const permission = await handle.queryPermission({ mode: 'read' });
        if (!mounted || controller.getSnapshot().status !== 'no-folder') return;
        if (permission === 'granted') {
          await controller.setSource(directorySource(handle));
        } else {
          setPendingRestore(handle);
        }
      } catch {
        // Ignore restore failures and remain on intro screen
      }
    })();
    return () => { mounted = false; };
  }, [controller]);
  useEffect(() => {
    const flush = () => { void notes.flushAll(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); void controller.dispose(); void notes.dispose(); urls.dispose(); };
  }, [controller, notes, urls]);
  useEffect(() => { if (!active) void notes.select(null); }, [active, notes]);

  async function choose() {
    if (!supportsDirectoryPicker()) { input.current?.click(); return; }
    try {
      const handle = await pickDirectoryHandle();
      setPickerError(null);
      setPendingRestore(null);
      await saveHandle(handle).catch(() => undefined);
      await controller.setSource(directorySource(handle));
    }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setPickerError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'folderError');
    }
  }

  async function resumeRestore() {
    if (!pendingRestore) return;
    try {
      const permission = pendingRestore.requestPermission ? await pendingRestore.requestPermission({ mode: 'read' }) : 'denied';
      if (permission === 'granted') {
        const handle = pendingRestore;
        setPendingRestore(null);
        setPickerError(null);
        await controller.setSource(directorySource(handle));
      } else {
        setPickerError('denied');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setPickerError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'folderError');
      }
    }
  }

  const status = pickerError ? m[pickerError] : state.status === 'error' ? m.folderError : state.status === 'access-denied' ? m.denied
    : state.status === 'loading' ? m.loading : state.status === 'empty' ? m.empty : state.status === 'no-supported' ? m.noSupported : '';
  const activate = (entryId: string) => { void controller.activate(entryId); };
  return <main className={styles.app}>
    <Header className={styles.header} title="Album" language={language} theme={theme} labels={m} onLanguageChange={setLanguage} onThemeChange={setTheme} />
    {state.status !== 'no-folder' && <div className={styles.controls}>
      <button data-folder-control onClick={() => void choose()}><Icon name="folder" />{m.change}</button>
      {state.canRefresh && <button disabled={state.scanning} onClick={() => { setPickerError(null); void controller.refresh(); }}><Icon name="refresh" />{m.refresh}</button>}
      {state.notice === 'reselect' && <p className={styles.hint}>{m.snapshot}</p>}
    </div>}
    <input ref={input} type="file" multiple {...{ webkitdirectory: '' }} hidden aria-label={m.choose}
      onChange={(event) => {
        if (event.target.files) {
          setPickerError(null);
          setPendingRestore(null);
          void clearHandle().catch(() => undefined);
          void controller.setSource(snapshotSource(Array.from(event.target.files)));
        }
        event.target.value = '';
      }} />
    {active ? <>
      <div className={styles.workspace}>
        <div className={styles.galleryArea}>
          <div className={styles.collectionStatus} role="status">{status}
            {[...new Set(state.issues.map((issue) => issue.code))].filter((code) => code !== 'unsupported').map((code) => <p key={code}>{code === 'unavailable' ? m.unavailable : m.deniedFiles}</p>)}
          </div>
          <Gallery key={state.folderGeneration} entries={state.entries} activeId={state.activeId} activate={activate} urls={urls} m={m} />
        </div>
        <Inspection entry={active} notes={notes} m={m} language={language} />
      </div>
      <ThumbnailStrip key={state.folderGeneration} entries={state.entries} activeId={state.activeId} activate={activate} urls={urls} m={m} />
    </> : pendingRestore ? <section className={styles.empty}>
      <div className={styles.emptyIcon}><Icon name="folder" /></div>
      <h2 role="status">{status || m.reopenFolder(pendingRestore.name ?? '')}</h2>
      {status && <p>{m.reopenFolder(pendingRestore.name ?? '')}</p>}
      <div className={styles.resumeActions}>
        <button data-folder-control className={styles.resumeButton} onClick={() => void resumeRestore()}>
          <Icon name="folder" />{m.resume}
        </button>
        <button data-folder-control className={styles.resumeSecondary} onClick={() => void choose()}>
          {m.chooseOther}
        </button>
      </div>
    </section> : <section className={styles.empty}>
      <div className={styles.emptyIcon}><Icon name="image" /></div>
      <h2 role="status">{status || m.intro}</h2>
      {!status && <p>{m.introDetail}</p>}
      <span className={styles.hint}>{m.formats}</span>
      {state.status === 'no-folder' && <button className={styles.emptyPicker} data-folder-control aria-label={m.choose} onClick={() => void choose()} />}
    </section>}
  </main>;
}
