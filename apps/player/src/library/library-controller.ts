import { imageFormat } from '@ai-tools/shared/image-format';
import { isActive, type AudioController, type AudioEvent } from '../audio/audio-controller';
import { isDuplicate, trackOrder, withSlot, type Slots, type Track } from '../domain/library';
import { isMp3 } from '../domain/mp3';
import { afterManualChange, defaultSession, nextRepeat, step, type Repeat, type Session, type StepReason } from '../domain/playback';
import { LibraryError, type Cover, type LibraryStore } from './library-repository';

export type Notice =
  | { code: 'notMp3' | 'duplicate' | 'quota' | 'saveFailed' | 'readFailed' | 'deleteFailed' | 'notImage'; name: string }
  | { code: 'coverQuota' | 'coverFailed' | 'coverDisplay' | 'unavailable' };

export interface LibraryState {
  /** Nothing is saved and no library command runs until the stored state has been read. */
  phase: 'loading' | 'ready' | 'unavailable';
  slots: Slots;
  tracks: Readonly<Record<string, Track>>;
  /** Rows whose transaction has not finished yet. */
  pending: Readonly<Record<number, 'adding' | 'deleting'>>;
  cover: Cover | null;
  coverPending: boolean;
  repeat: Repeat;
  shuffle: boolean;
  used: readonly string[];
  notice: Notice | null;
}

const initial: LibraryState = { phase: 'loading', slots: [], tracks: {}, pending: {}, cover: null, coverPending: false,
  repeat: defaultSession.repeat, shuffle: defaultSession.shuffle, used: defaultSession.used, notice: null };
const progressSaveInterval = 5000;

/** Library contents, row commands and session persistence; the audio controller performs playback. */
export class LibraryController {
  private state: LibraryState = initial;
  private readonly listeners = new Set<() => void>();
  private readonly repository: LibraryStore;
  private readonly audio: AudioController;
  /** Supplies the random value of each shuffle choice; the rules themselves stay pure. */
  private readonly random: () => number;
  /** Files whose add transaction is in flight, by row, for the duplicate rule. */
  private readonly adding = new Map<number, Pick<Track, 'name' | 'size' | 'lastModified'>>();
  private loadStarted = false;
  private saving: Promise<void> | null = null;
  private saveAgain = false;
  private lastProgressSave = 0;
  private persistenceRequested = false;

  constructor(repository: LibraryStore, audio: AudioController, random: () => number = Math.random) {
    this.repository = repository;
    this.audio = audio;
    this.random = random;
  }

  getSnapshot = (): LibraryState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  /** Follows audio events and starts the load phase once; the returned function stops following. */
  connect(): () => void {
    const disconnect = this.audio.onEvent((event) => this.onAudioEvent(event));
    if (!this.loadStarted) { this.loadStarted = true; void this.load(); }
    return disconnect;
  }

  /** Clicking a row: switch and play while playing, otherwise prepare paused; the current row changes nothing. */
  select(trackId: string): void {
    if (this.state.phase !== 'ready' || !this.playable().includes(trackId)) return;
    const audio = this.audio.getSnapshot();
    if (audio.trackId === trackId) return;
    const repeat = audio.trackId ? afterManualChange(this.state.repeat) : this.state.repeat;
    if (repeat !== this.state.repeat) this.publish({ ...this.state, repeat });
    this.prepare(trackId, isActive(audio));
    void this.saveSession();
  }

  /** Next and Previous: the target starts from 0 and plays only while playback is active or requested. */
  next(): void { this.move('next'); }
  previous(): void { this.move('previous'); }

  /** Off → all → one → off; saved at once like every setting change. */
  cycleRepeat(): void {
    if (this.state.phase !== 'ready') return;
    this.publish({ ...this.state, repeat: nextRepeat(this.state.repeat) });
    void this.saveSession();
  }

  /** Toggling never clears the used tracks or interrupts playback. */
  toggleShuffle(): void {
    if (this.state.phase !== 'ready') return;
    this.publish({ ...this.state, shuffle: !this.state.shuffle });
    void this.saveSession();
  }

  setMuted(muted: boolean): void {
    if (this.state.phase !== 'ready') return;
    this.audio.setMuted(muted);
    void this.saveSession();
  }

  /** Adds `file` to an empty row only after its transaction commits; a refused save leaves the library unchanged. */
  async add(index: number, file: File): Promise<void> {
    if (this.state.phase !== 'ready' || this.state.slots[index] || this.state.pending[index] !== undefined) return;
    if (isDuplicate([...Object.values(this.state.tracks), ...this.adding.values()], file)) {
      this.notify({ code: 'duplicate', name: file.name });
      return;
    }
    this.adding.set(index, { name: file.name, size: file.size, lastModified: file.lastModified });
    this.publish({ ...this.state, pending: { ...this.state.pending, [index]: 'adding' } });
    let notice: Notice | null = null;
    let track: Track | null = null;
    try {
      if (!await isMp3(file)) notice = { code: 'notMp3', name: file.name };
      else {
        const candidate: Track = { id: crypto.randomUUID(), name: file.name, size: file.size, type: 'audio/mpeg', lastModified: file.lastModified };
        await this.repository.addTrack(candidate, file, index);
        track = candidate;
      }
    } catch (error) {
      notice = { code: !(error instanceof LibraryError) ? 'readFailed' : error.code === 'quota' ? 'quota' : 'saveFailed', name: file.name };
    }
    this.adding.delete(index);
    const pending = { ...this.state.pending };
    delete pending[index];
    if (!track) { this.publish({ ...this.state, pending, notice }); return; }
    const firstTrack = Object.keys(this.state.tracks).length === 0;
    this.publish({ ...this.state, pending, notice: null, slots: withSlot(this.state.slots, index, track.id),
      tracks: { ...this.state.tracks, [track.id]: track } });
    // Only the first track of an empty library becomes current, paused.
    if (firstTrack && !this.audio.getSnapshot().trackId) { this.prepare(track.id, false); void this.saveSession(); }
    void this.requestPersistence();
  }

  /** Deleting the current track stops it and hides the panel at once; the row clears after the commit. */
  async remove(index: number): Promise<void> {
    const trackId = this.state.slots[index];
    const track = trackId ? this.state.tracks[trackId] : undefined;
    if (this.state.phase !== 'ready' || !trackId || !track || this.state.pending[index] !== undefined) return;
    if (this.audio.getSnapshot().trackId === trackId) this.audio.clear();
    this.publish({ ...this.state, pending: { ...this.state.pending, [index]: 'deleting' } });
    let failed = false;
    try { await this.repository.deleteTrack(trackId, index); } catch { failed = true; }
    const pending = { ...this.state.pending };
    delete pending[index];
    if (failed) { this.publish({ ...this.state, pending, notice: { code: 'deleteFailed', name: track.name } }); return; }
    const tracks = { ...this.state.tracks };
    delete tracks[trackId];
    this.publish({ ...this.state, pending, tracks, slots: withSlot(this.state.slots, index, null), used: this.state.used.filter((id) => id !== trackId) });
    void this.saveSession();
  }

  /** A refused or failed cover save keeps the previous cover. */
  async replaceCover(file: File): Promise<void> {
    if (this.state.phase !== 'ready' || this.state.coverPending) return;
    this.publish({ ...this.state, coverPending: true });
    let notice: Notice | null = null;
    let cover: Cover | null = null;
    try {
      const format = await imageFormat(file);
      if (!format) notice = { code: 'notImage', name: file.name };
      else {
        const candidate: Cover = { imageId: crypto.randomUUID(), format, blob: file };
        await this.repository.replaceCover(candidate);
        cover = candidate;
      }
    } catch (error) {
      notice = !(error instanceof LibraryError) ? { code: 'readFailed', name: file.name } : { code: error.code === 'quota' ? 'coverQuota' : 'coverFailed' };
    }
    this.publish({ ...this.state, coverPending: false, notice, cover: cover ?? this.state.cover });
    if (cover) void this.requestPersistence();
  }

  /** The stored image is kept when the browser cannot decode it. */
  coverDisplayFailed(): void { this.notify({ code: 'coverDisplay' }); }

  /**
   * Saves the current track, position and modes; writes are serialized and coalesced, and nothing is
   * written before the load phase ends. Failures are ignored: the next trigger writes the newer state.
   */
  saveSession(): Promise<void> {
    if (this.state.phase !== 'ready') return Promise.resolve();
    if (this.saving) { this.saveAgain = true; return this.saving; }
    const run = async () => {
      do {
        this.saveAgain = false;
        try { await this.repository.saveSession(this.session()); } catch { /* Best effort. */ }
      } while (this.saveAgain);
    };
    this.saving = run().finally(() => { this.saving = null; });
    return this.saving;
  }

  private async load(): Promise<void> {
    const stored = await this.repository.load().catch(() => null);
    if (!stored) { this.publish({ ...this.state, phase: 'unavailable', notice: { code: 'unavailable' } }); return; }
    const { tracks, slots, cover, session } = stored;
    this.publish({ ...this.state, phase: 'ready', slots, cover, tracks: Object.fromEntries(tracks.map((track) => [track.id, track])),
      repeat: session.repeat, shuffle: session.shuffle, used: session.used });
    this.audio.setMuted(session.muted);
    // Reopening restores the saved track and position, paused.
    if (session.currentTrackId) this.prepare(session.currentTrackId, false, session.position);
  }

  private prepare(trackId: string, play: boolean, position = 0): void {
    this.audio.prepare(trackId, () => this.repository.readAudio(trackId), { play, position });
  }

  private onAudioEvent(event: AudioEvent): void {
    switch (event.type) {
      case 'playing':
        this.lastProgressSave = Date.now();
        // A track becomes used when its playback actually starts with shuffle on.
        if (this.state.shuffle && !this.state.used.includes(event.trackId)) {
          this.publish({ ...this.state, used: [...this.state.used, event.trackId] });
          void this.saveSession();
        }
        break;
      case 'paused': void this.saveSession(); break;
      case 'progress':
        if (this.audio.getSnapshot().status === 'playing' && Date.now() - this.lastProgressSave >= progressSaveInterval) {
          this.lastProgressSave = Date.now();
          void this.saveSession();
        }
        break;
      // Repeat and shuffle run here; the element never uses native `loop`.
      case 'ended': this.advance('ended', event.trackId, true); break;
      // A notice takes precedence in the status line, so a newer playback error replaces it.
      case 'error': if (this.state.notice) this.publish({ ...this.state, notice: null }); break;
    }
  }

  private move(reason: 'next' | 'previous'): void {
    const audio = this.audio.getSnapshot();
    // `isActive` includes a requested play that has not started yet, so a click during a switch keeps playing.
    if (this.state.phase === 'ready' && audio.trackId) this.advance(reason, audio.trackId, isActive(audio));
  }

  /** Applies the repeat and shuffle rules; `play` decides whether the target starts or stays paused. */
  private advance(reason: StepReason, current: string, play: boolean): void {
    const result = step({ order: this.playable(), current, used: this.state.used, repeat: this.state.repeat,
      shuffle: this.state.shuffle, reason, random: this.random() });
    this.publish({ ...this.state, used: result.used, repeat: result.repeat });
    if (result.type === 'track' && result.trackId !== current) this.prepare(result.trackId, play);
    // The same track again starts from 0, playing or paused; a stop also rewinds it and pauses.
    else if (result.type === 'track' && play) this.audio.restart();
    else if (result.type !== 'none') this.audio.stop();
    void this.saveSession();
  }

  private session(): Session {
    const audio = this.audio.getSnapshot();
    const current = audio.trackId !== null && this.state.tracks[audio.trackId] ? audio.trackId : null;
    return { currentTrackId: current, position: current ? audio.position : 0, muted: audio.muted,
      repeat: this.state.repeat, shuffle: this.state.shuffle, used: this.state.used };
  }

  /** Asked once after the first successful file save while storage is not yet persistent; the result is ignored. */
  private async requestPersistence(): Promise<void> {
    if (this.persistenceRequested) return;
    this.persistenceRequested = true;
    try { if (navigator.storage && !await navigator.storage.persisted()) await navigator.storage.persist(); }
    catch { /* Persistence is optional. */ }
  }

  /** Occupied rows in visible order, without rows whose transaction is still running. */
  private playable(): string[] {
    return trackOrder(this.state.slots.map((id, index) => id !== null && this.state.tracks[id] && this.state.pending[index] === undefined ? id : null));
  }

  private notify(notice: Notice): void { this.publish({ ...this.state, notice }); }

  private publish(state: LibraryState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
