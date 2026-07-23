"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getSpeechLang, isSpeechRecognitionSupported } from "@/lib/speechLanguageMap";

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
  supported: boolean;
  error: string | null;
}

export function useSpeechRecognition(language: string): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const speechLang = getSpeechLang(language);
  const supported = isSpeechRecognitionSupported() && speechLang !== null;

  const startListening = useCallback(() => {
    if (!supported || !speechLang) return;

    setError(null);
    setTranscript("");
    setInterimTranscript("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = speechLang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      if (!mountedRef.current) return;
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) setTranscript(final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      if (!mountedRef.current) return;
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [supported, speechLang]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Stop recognition on unmount and guard against setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { isListening, transcript, interimTranscript, startListening, stopListening, reset, supported, error };
}
