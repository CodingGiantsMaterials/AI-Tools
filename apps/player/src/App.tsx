import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Header, useDocumentPreferences, type Theme } from '@ai-tools/shared/header';
import { browserLanguage, isLanguage, type Language } from '@ai-tools/shared/i18n';
import { savePreference, storedPreference } from '@ai-tools/shared/preferences';
import { AudioController, type AudioState } from './audio/audio-controller';
import { LibraryController, type Notice } from './library/library-controller';
import { LibraryRepository } from './library/library-repository';
import { CoverField } from './components/CoverField';
import { PlayerPanel } from './components/PlayerPanel';
import { TrackList } from './components/TrackList';
import { messages, type Messages } from './i18n';
import styles from './App.module.css';

const preferencePrefix = 'ai-tools-player';

function noticeText(notice: Notice, m: Messages): string {
  switch (notice.code) {
    case 'coverQuota': case 'coverFailed': case 'coverDisplay': case 'unavailable': return m[notice.code];
    default: return m[notice.code](notice.name);
  }
}
const audioErrors = { load: 'loadFailed', playback: 'playbackFailed', play: 'playFailed' } as const satisfies Record<NonNullable<AudioState['error']>, keyof Messages>;

export function App() {
  const [{ audio, library }] = useState(() => {
    const audio = new AudioController();
    return { audio, library: new LibraryController(new LibraryRepository(), audio) };
  });
  const audioState = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  const libraryState = useSyncExternalStore(library.subscribe, library.getSnapshot);
  // Only a manual choice is saved, so the detected language follows the browser until the user picks one.
  const [language, setLanguage] = useState<Language>(() => { const saved = storedPreference(preferencePrefix, 'language'); return isLanguage(saved) ? saved : browserLanguage(); });
  const [theme, setTheme] = useState<Theme>(() => storedPreference(preferencePrefix, 'theme') === 'dark' ? 'dark' : 'light');
  // A new version waits until the user applies it here; nothing reloads on its own (registerType 'prompt').
  const updateRequested = useRef(false);
  const updateActive = useRef(false);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    // Called when the new version takes control. If another tab applied it, this tab keeps playing and keeps the offer.
    onNeedReload: () => { if (updateRequested.current) window.location.reload(); else updateActive.current = true; },
  });
  const applyUpdate = async () => {
    updateRequested.current = true;
    setNeedRefresh(false);
    // The reload restores the library, track and position paused, so playback stops where the session is saved.
    audio.pause();
    await library.saveSession();
    if (updateActive.current) window.location.reload();
    else await updateServiceWorker(true);
  };
  const m = messages[language];
  useDocumentPreferences(language, theme);
  useEffect(() => {
    const stopAudio = audio.connect();
    const stopLibrary = library.connect();
    const flush = () => { void library.saveSession(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility);
      flush(); stopLibrary(); stopAudio();
    };
  }, [audio, library]);

  const status = libraryState.notice ? noticeText(libraryState.notice, m) : audioState.error ? m[audioErrors[audioState.error]] : '';
  return <div className={styles.app}>
    <Header className={styles.header} title="Player" language={language} theme={theme} labels={m}
      onLanguageChange={(value) => { setLanguage(value); savePreference(preferencePrefix, 'language', value); }}
      onThemeChange={(value) => { setTheme(value); savePreference(preferencePrefix, 'theme', value); }}>
      {needRefresh && <div className={styles.update} role="status">
        <span>{m.updateAvailable}</span>
        <button onClick={() => void applyUpdate()}>{m.update}</button>
      </div>}
    </Header>
    <main className={styles.main}>
      <CoverField cover={libraryState.cover} disabled={libraryState.phase !== 'ready' || libraryState.coverPending} m={m}
        onChoose={(file) => void library.replaceCover(file)} onDisplayError={() => library.coverDisplayFailed()} />
      <TrackList state={libraryState} currentId={audioState.trackId} m={m}
        onAdd={(index, file) => void library.add(index, file)} onRemove={(index) => void library.remove(index)} onSelect={(id) => library.select(id)} />
      <p className={styles.status} role="status">{status}</p>
    </main>
    {audioState.trackId && <PlayerPanel state={audioState} repeat={libraryState.repeat} shuffle={libraryState.shuffle} audio={audio} library={library} m={m} />}
  </div>;
}
