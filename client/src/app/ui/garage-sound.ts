import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { EngineLoading } from './engine-loading';

const soundFiles = {
  start: 'engine-start',
  rev: 'engine-rev',
  door: 'door-roll-up',
  click: 'soft-click',
} as const;
type Sound = keyof typeof soundFiles;
const preferenceKey = 'apaar-garage-muted';
const activationKey = 'apaar-garage-audio-activated';

@Injectable({ providedIn: 'root' })
export class GarageSound {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;
  private readonly engine = inject(EngineLoading);
  private readonly preference = signal(this.initialMute());
  readonly muted = this.preference.asReadonly();
  private readonly activated = signal(false);
  private readonly visible = signal(!this.document.hidden);
  private readonly downloads = new Map<Sound, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<Sound, Promise<AudioBuffer | null>>();
  private readonly playing = new Set<AudioBufferSourceNode>();
  private context?: AudioContext;
  private master?: GainNode;
  private rev?: AudioBufferSourceNode;
  private revPending = false;
  private revWanted = false;
  private revProgress = 0;
  private generation = 0;
  private destroyed = false;

  constructor() {
    const view = this.view;
    const visibility = () => {
      this.visible.set(!this.document.hidden);
      if (this.document.hidden) this.stop();
    };
    this.document.addEventListener('visibilitychange', visibility);
    const resumeOnClick = (event: MouseEvent) => {
      if (!event.isTrusted || this.activated() || this.muted()) return;
      try {
        if (view?.sessionStorage.getItem(activationKey) === 'true') this.activate();
      } catch { /* A fresh gesture can still enable sound from the toggle. */ }
    };
    this.document.addEventListener('click', resumeOnClick, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.document.removeEventListener('visibilitychange', visibility);
      this.document.removeEventListener('click', resumeOnClick, { capture: true });
      this.stop();
      void this.context?.close().catch(() => {});
    });
    effect(() => {
      const status = this.engine.state();
      const audible = this.activated() && !this.muted() && this.visible();
      this.revWanted = Boolean(audible && status && !status.ready);
      this.revProgress = status?.progress ?? 0;
      if (this.revWanted) this.updateRev();
      else this.stopRev();
    });
  }

  toggle() {
    const muted = !this.muted();
    this.preference.set(muted);
    try { this.view?.localStorage.setItem(preferenceKey, muted ? 'true' : 'false'); } catch { /* Storage may be blocked. */ }
    if (muted) this.stop();
    else if (this.activate()) this.click();
  }

  prepareIntro() {
    if (!this.activate()) return;
    for (const sound of ['click', 'door', 'start'] as const) void this.download(sound);
  }

  enter() {
    void this.play('start');
    void this.play('door');
  }

  click() {
    if (this.activated()) void this.play('click');
  }

  stopIntro() {
    this.stop();
    if (this.revWanted) this.updateRev();
  }

  private initialMute() {
    try {
      const stored = this.view?.localStorage.getItem(preferenceKey);
      if (stored === 'true' || stored === 'false') return stored === 'true';
    } catch { /* Storage may be blocked. */ }
    return this.view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private activate() {
    if (!this.view || this.muted() || this.document.hidden) return false;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
      this.activated.set(true);
      try { this.view.sessionStorage.setItem(activationKey, 'true'); } catch { /* Storage may be blocked. */ }
      return true;
    } catch {
      return false;
    }
  }

  private download(sound: Sound) {
    let request = this.downloads.get(sound);
    if (!request) {
      request = fetch('/audio/' + soundFiles[sound] + '.wav')
        .then((response) => response.ok ? response.arrayBuffer() : null)
        .catch(() => null);
      this.downloads.set(sound, request);
    }
    return request;
  }

  private decode(sound: Sound, context: AudioContext) {
    let buffer = this.buffers.get(sound);
    if (!buffer) {
      buffer = this.download(sound)
        .then((bytes) => bytes ? context.decodeAudioData(bytes) : null)
        .catch(() => null);
      this.buffers.set(sound, buffer);
    }
    return buffer;
  }

  private async play(sound: Sound) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted() || this.document.hidden) return;
    const generation = this.generation;
    const buffer = await this.decode(sound, context);
    if (!buffer || this.destroyed || generation !== this.generation || this.muted() ||
        this.document.hidden || (sound === 'rev' && !this.revWanted)) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = sound === 'rev';
    source.connect(master);
    this.playing.add(source);
    source.onended = () => { this.playing.delete(source); source.disconnect(); };
    if (source.loop) {
      this.rev = source;
      this.pitchRev();
    }
    source.start();
  }

  private pitchRev() {
    if (this.rev && this.context) {
      this.rev.playbackRate.setTargetAtTime(0.72 + this.revProgress * 1.05, this.context.currentTime, .08);
    }
  }

  private updateRev() {
    this.pitchRev();
    if (this.rev || this.revPending) return;
    this.revPending = true;
    void this.play('rev').finally(() => { this.revPending = false; });
  }

  private stopRev() {
    this.rev?.stop();
    this.rev = undefined;
  }

  private stop() {
    this.generation++;
    for (const source of this.playing) source.stop();
    this.playing.clear();
    this.rev = undefined;
  }
}
