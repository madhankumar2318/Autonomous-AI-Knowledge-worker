import { useEffect, useRef, useState } from "react";
import { showToast } from "../components/Toast";

interface UseSpeechRecognitionProps {
  onTranscript: (text: string) => void;
}

export function useSpeechRecognition({ onTranscript }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          setSupported(true);
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = "en-US";

          recognition.onstart = () => {
            setIsListening(true);
          };
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
              onTranscript(transcript);
              showToast("success", `Voice input: "${transcript}"`);
            }
          };
          recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            showToast("error", "Voice input failed or was denied.");
            setIsListening(false);
          };
          recognition.onend = () => {
            setIsListening(false);
          };
          recognitionRef.current = recognition;
        }
      } catch (e) {
        console.warn("Speech Recognition failed to initialize:", e);
      }
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast("error", "Speech recognition not supported in this browser. Use Chrome or Safari.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return {
    isListening,
    toggleListening,
    supported,
  };
}
