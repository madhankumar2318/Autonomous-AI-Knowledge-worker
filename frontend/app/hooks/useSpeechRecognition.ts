import { useEffect, useRef, useState, useCallback } from "react";
import { showToast } from "../components/Toast";

interface UseSpeechRecognitionProps {
  onTranscript: (text: string) => void;
}

export function useSpeechRecognition({ onTranscript }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          setSupported(true);
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onstart = () => {
            setIsListening(true);
            setTranscriptPreview("");
          };

          recognition.onresult = (event: any) => {
            let interim = "";
            let final = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }

            if (interim) {
              setTranscriptPreview(interim);
            }

            if (final) {
              onTranscript(final.trim());
              setTranscriptPreview("");
              showToast("success", `Voice dictation captured!`);
            }
          };

          recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            if (event.error !== "no-speech") {
              showToast("error", `Voice error: ${event.error}`);
            }
            setIsListening(false);
            setTranscriptPreview("");
          };

          recognition.onend = () => {
            setIsListening(false);
            setTranscriptPreview("");
          };

          recognitionRef.current = recognition;
        }
      } catch (e) {
        console.warn("Speech Recognition failed to initialize:", e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      showToast("error", "Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
        showToast("error", "Could not access microphone.");
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
