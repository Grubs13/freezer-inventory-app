'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Handlers = { onText: (text: string) => void; onDone: (text: string) => void; onError: (message: string) => void };

/** Browser speech recognition. Ends by itself after a short pause, or when stop() is called. Client-only: mount after user interaction. */
export function useSpeech() {
  const [supported] = useState(() => recognitionClass() !== null);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback((h: Handlers) => {
    const Ctor = recognitionClass();
    if (!Ctor) return false;
    rec.current?.abort();
    const r = new Ctor();
    let heard = '';
    let failed = false;
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      heard = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join('');
      h.onText(heard);
    };
    r.onerror = (e) => {
      if (e.error === 'aborted') return;
      failed = true;
      h.onError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'The microphone is blocked for this site. You can type instead.'
          : e.error === 'no-speech'
            ? 'Didn’t hear anything. Try again, or type it.'
            : 'Voice isn’t working right now. You can type instead.',
      );
    };
    r.onend = () => {
      if (rec.current === r) rec.current = null;
      if (!failed) h.onDone(heard);
    };
    rec.current = r;
    r.start();
    return true;
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  const cancel = useCallback(() => {
    const r = rec.current;
    rec.current = null;
    if (r) {
      r.onend = null;
      r.abort();
    }
  }, []);

  return { supported, start, stop, cancel };
}
