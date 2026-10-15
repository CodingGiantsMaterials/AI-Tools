import { ObjectUrls } from '@ai-tools/shared/object-urls';
import { restorablePosition } from '../domain/playback';

export interface AudioState {
  /** The selected (current) track; `null` hides the player panel. */
  trackId: string | null;
  /** Real element state: only audio events and settled operations change it, never a click alone. */
  status: 'idle' | 'preparing' | 'paused' | 'playing' | 'error';
  /** Whether playback should start, or continue, once the current track is prepared. */
  playIntent: boolean;
  position: number;
  duration: number;
  muted: boolean;
  /** `load`: the stored file could not be read; `playback`: the browser cannot decode or play it; `play`: `play()` was refused. */
  error: 'load' | 'playback' | 'play' | null;
}
/** `ended` is a natural end of playback; `error` reports a new value of `AudioState.error`. */
export interface AudioEvent { type: 'playing' | 'paused' | 'ended' | 'progress' | 'error'; trackId: string }
export interface PrepareOptions { position?: number; play?: boolean }

const idle: AudioState = { trackId: null, status: 'idle', playIntent: false, position: 0, duration: 0, muted: false, error: null };
const fixedVolume = 0.5;

/**
 * Playing, or playback requested and not yet settled (a track preparing to play, or a pending `play()`).
 * The play/pause button and every "while playing" decision use it, so none lags behind a switch.
 */
export function isActive(state: AudioState): boolean {
  return state.status === 'playing' || state.playIntent;
}

/**
 * The only owner of the application's audio element. Every track change increments the request number;
 * a blob read, metadata or `play()` result that belongs to an older request is ignored.
 */
export class AudioController {
  private element: HTMLAudioElement | null = null;
  private readonly createElement: () => HTMLAudioElement;
  private readonly urls = new ObjectUrls();
  private state: AudioState = idle;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: AudioEvent) => void>();
  private request = 0;
  private lease: { url: string; release: () => void } | null = null;
  private pendingPosition = 0;
  private readonly handlers: [keyof HTMLMediaElementEventMap, () => void][] = [
    ['loadedmetadata', () => this.onMetadata()], ['durationchange', () => this.onDuration()],
    ['timeupdate', () => this.onTime()], ['seeked', () => this.onTime()], ['playing', () => this.onPlaying()],
    ['pause', () => this.onPause()], ['ended', () => this.onEnded()], ['error', () => this.onError()],
    ['volumechange', () => this.publish({ ...this.state, muted: this.audio.muted })],
  ];

  /** The element is created on first use, so an instance that React discards (Strict Mode) never creates one. */
  constructor(createElement: () => HTMLAudioElement = () => new Audio()) { this.createElement = createElement; }

  private get audio(): HTMLAudioElement {
    if (!this.element) {
      this.element = this.createElement();
      this.element.preload = 'auto';
      // Set once; muting uses `muted`, so unmuting restores this level.
      this.element.volume = fixedVolume;
    }
    return this.element;
  }

  getSnapshot = (): AudioState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  onEvent(listener: (event: AudioEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  }

  /** Attaches the element listeners; the returned function detaches them and pauses, so it can run again. */
  connect(): () => void {
    for (const [type, handler] of this.handlers) this.audio.addEventListener(type, handler);
    return () => {
      for (const [type, handler] of this.handlers) this.audio.removeEventListener(type, handler);
      this.audio.pause();
      if (isActive(this.state)) this.publish({ ...this.state, status: this.state.status === 'playing' ? 'paused' : this.state.status, playIntent: false });
    };
  }

  /** Stops the previous sound immediately, then reads and prepares `trackId`; it plays only when `play` is set. */
  prepare(trackId: string, read: () => Promise<Blob>, { position = 0, play = false }: PrepareOptions = {}): void {
    const request = ++this.request;
    this.detachSource();
    this.pendingPosition = position;
    this.publish({ ...this.state, trackId, status: 'preparing', playIntent: play, position, duration: 0, error: null });
    read().then((blob) => {
      if (request !== this.request) return;
      this.lease = this.urls.acquire(trackId, blob);
      this.audio.src = this.lease.url;
    }, () => {
      if (request === this.request) this.fail('load');
    });
  }

  play(): void {
    const { trackId, status } = this.state;
    if (!trackId || status === 'playing') return;
    if (status === 'preparing') { if (!this.state.playIntent) this.publish({ ...this.state, playIntent: true }); return; }
    if (!this.lease) return; // The stored file could not be read; there is nothing to play.
    // A track paused at its end starts again from the beginning in every browser; Chrome would otherwise end it at once.
    const atEnd = this.audio.ended || this.audio.duration > 0 && this.audio.currentTime >= this.audio.duration;
    if (atEnd) this.audio.currentTime = 0;
    this.publish({ ...this.state, playIntent: true, error: null, position: atEnd ? 0 : this.state.position });
    this.startPlayback();
  }

  /** `pause()` settles synchronously, so the state is paused at once; the `pause` event then saves the position. */
  pause(): void {
    const { trackId, status } = this.state;
    if (!trackId) return;
    if (status !== 'preparing') this.audio.pause();
    this.publish({ ...this.state, status: status === 'playing' ? 'paused' : status, playIntent: false });
  }

  toggle(): void { if (isActive(this.state)) this.pause(); else this.play(); }

  /** Moves the position without changing the play state. */
  seek(position: number): void {
    const { trackId, status, duration } = this.state;
    if (!trackId || !Number.isFinite(position)) return;
    const target = Math.min(Math.max(position, 0), duration);
    if (status === 'preparing') this.pendingPosition = target;
    else this.audio.currentTime = target;
    this.publish({ ...this.state, position: target });
  }

  /** Same track from 0, playing (repeat-one, or a step that returns the current track). */
  restart(): void {
    if (!this.state.trackId) return;
    if (this.state.status === 'preparing') { this.pendingPosition = 0; this.publish({ ...this.state, position: 0, playIntent: true }); return; }
    if (!this.lease) return; // The stored file could not be read; there is nothing to play.
    this.audio.currentTime = 0;
    this.publish({ ...this.state, position: 0, playIntent: true, error: null });
    this.startPlayback();
  }

  /** Pause and rewind; the track stays selected and the panel visible. */
  stop(): void {
    if (!this.state.trackId) return;
    this.audio.pause();
    if (this.state.status === 'preparing') this.pendingPosition = 0;
    else this.audio.currentTime = 0;
    this.publish({ ...this.state, status: this.state.status === 'playing' ? 'paused' : this.state.status, playIntent: false, position: 0 });
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
    this.publish({ ...this.state, muted });
  }

  /** Stops the sound, releases the prepared file and deselects the track, which hides the panel. */
  clear(): void {
    this.request++;
    this.detachSource();
    this.publish({ ...idle, muted: this.state.muted });
  }

  private detachSource(): void {
    this.audio.pause();
    if (!this.lease) return;
    this.audio.removeAttribute('src');
    this.audio.load();
    this.lease.release();
    this.lease = null;
  }

  private startPlayback(): void {
    const request = this.request;
    this.audio.play().catch((error: unknown) => {
      // A newer request, a pause or a source change superseded this attempt.
      if (request !== this.request || !this.state.playIntent || error instanceof DOMException && error.name === 'AbortError') return;
      this.fail('play', this.audio.paused && this.state.status === 'playing' ? 'paused' : this.state.status);
    });
  }

  private fail(error: NonNullable<AudioState['error']>, status: AudioState['status'] = 'error'): void {
    this.publish({ ...this.state, status, playIntent: false, error });
    this.emit('error');
  }

  /** Element events always belong to the current source: `detachSource()` calls `load()`, which drops queued events of the old one. */
  private current(): boolean { return this.lease !== null && this.state.trackId !== null; }

  private onMetadata(): void {
    if (!this.current() || this.state.status !== 'preparing') return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    const position = restorablePosition(this.pendingPosition, duration);
    if (position > 0) this.audio.currentTime = position;
    this.publish({ ...this.state, status: 'paused', duration, position });
    if (this.state.playIntent) this.startPlayback();
  }

  private onDuration(): void {
    if (!this.current()) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    if (duration !== this.state.duration) this.publish({ ...this.state, duration });
  }

  private onTime(): void {
    if (!this.current() || this.state.status === 'preparing') return;
    this.publish({ ...this.state, position: this.audio.currentTime });
    this.emit('progress');
  }

  private onPlaying(): void {
    if (!this.current() || this.state.status === 'preparing') return;
    this.publish({ ...this.state, status: 'playing', error: null });
    this.emit('playing');
  }

  private onPause(): void {
    if (!this.current() || this.state.status !== 'playing' && this.state.status !== 'paused') return;
    // At a natural end the element pauses just before `ended`; playback stays active until the end decides what follows.
    if (this.audio.ended && this.state.status === 'playing') return;
    this.publish({ ...this.state, status: 'paused', playIntent: false, position: this.audio.currentTime });
    this.emit('paused');
  }

  /** Only an end reached during playback is natural. Firefox also ends a paused track seeked to its end; it stays paused there. */
  private onEnded(): void {
    if (!this.current()) return;
    const natural = isActive(this.state);
    this.publish({ ...this.state, status: 'paused', playIntent: false });
    if (natural) this.emit('ended');
  }

  /** The stored file was read, so an element error means that the browser cannot decode or play it. */
  private onError(): void {
    if (this.current()) this.fail('playback');
  }

  private emit(type: AudioEvent['type']): void {
    const trackId = this.state.trackId;
    if (trackId) for (const listener of this.eventListeners) listener({ type, trackId });
  }

  private publish(state: AudioState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
