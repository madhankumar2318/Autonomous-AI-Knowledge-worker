import { useEffect, useRef, useState, useCallback } from "react";
import { showToast } from "../components/Toast";

interface UseSpeechRecognitionProps {
  onTranscript: (text: string) => void;
}

export function useSpeechRecognition({ onTranscript }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  
  // Stable ref for callback to avoid re-initializing recognition on re-renders
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSupported(false);
        return;
      }

      setSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isManuallyStoppedRef.current = false;
        setIsListening(true);
        setTranscriptPreview("");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (interim) {
          setTranscriptPreview(interim);
        }

        if (final) {
          const cleanFinal = final.trim();
          if (cleanFinal) {
            onTranscriptRef.current(cleanFinal);
            setTranscriptPreview("");
            showToast("success", `Captured: "${cleanFinal}"`);
          }
        }
      };

      recognition.onerror = (event: any) => {
        const err = event.error;
        console.warn("Speech recognition status:", err);

        // Filter out harmless/normal events
        if (err === "aborted" || err === "no-speech") {
          setIsListening(false);
          setTranscriptPreview("");
          return;
        }

        if (err === "not-allowed" || err === "service-not-allowed") {
          showToast(
            "error",
            "Microphone access blocked. Click the lock/tune icon in your browser address bar to allow microphone."
          );
        } else if (err === "network") {
          showToast("error", "Speech recognition network error. Please check your internet connection.");
        } else {
          showToast("error", `Voice recognition: ${err}`);
        }

        setIsListening(false);
        setTranscriptPreview("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setTranscriptPreview("");
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("Speech Recognition initialization failed:", e);
      setSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          isManuallyStoppedRef.current = true;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []); // Run ONCE on mount

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      showToast(
        "error",
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."
      );
      return;
    }

    if (isListening) {
      isManuallyStoppedRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setTranscriptPreview("");
    } else {
      try {
        isManuallyStoppedRef.current = false;
        recognitionRef.current.start();
      } catch (e: any) {
        // If already started, stop and restart cleanly
        console.warn("Speech start exception:", e);
        try {
          recognitionRef.current.abort();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.error("Failed to start speech recognition:", err);
            }
          }, 100);
        } catch {
          showToast("error", "Microphone busy. Please try clicking again.");
        }
      }
    }
  }, [isListening]);

  return {
    isListening,
    toggleListening,
    transcriptPreview,
    supported,
  };
}
