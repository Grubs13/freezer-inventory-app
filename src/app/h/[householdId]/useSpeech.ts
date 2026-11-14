'use client';

import { useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  useEffect(() => setSupported(recognitionClass() !== null), []);

  function start() {
    const Ctor = recognitionClass();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final = e.results[i].isFinal;
      }
      callback.current(text, final);
    };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone access is blocked for this site.' : 'Could not hear that. Try again or type it.');
    r.onend = () => setListening(false);
    rec.current = r;
    setError('');
    setListening(true);
    r.start();
  }

  function stop() {
    rec.current?.stop();
  }

  return { supported, listening, error, start, stop };
}
