import { useEffect, useRef, useState, useCallback } from "react";
import { showToast } from "../components/Toast";

// Helper to strip markdown formatting so speech sounds natural
function cleanMarkdownForSpeech(text: string): string {
  if (!text) return "";
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, " [code snippet omitted] ")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove image and links markdown [text](url) -> text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // Remove bold and italic asterisks / underscores
    .replace(/(\*\*|\*|__|_)(.*?)\1/g, "$2")
    // Remove header hashes
    .replace(/^#{1,6}\s+/gm, "")
    // Remove blockquote arrows
    .replace(/^>\s+/gm, "")
    // Remove markdown tables
    .replace(/\|[^\n]+\|/g, "")
    // Remove bullet points / numbering prefixes
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove multiple newlines and spaces
    .replace(/\s+/g, " ")
    .trim();
}

export function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available.length > 0) {
          setVoices(available);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      };
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
  }, []);

  const speak = useCallback(
    (text: string, id: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        showToast("error", "Speech synthesis is not supported on this browser.");
        return;
      }

      // If already speaking this message, toggle stop
      if (speakingId === id) {
        stop();
        return;
      }

      // Stop any current speech
      window.speechSynthesis.cancel();

      const cleanedText = cleanMarkdownForSpeech(text);
      if (!cleanedText) {
        showToast("warning", "No readable text found in this response.");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.rate = 1.05; // Slightly faster, natural executive cadence
      utterance.pitch = 1.0;

      // Prioritize natural English voices
      if (voices.length > 0) {
        const preferredVoice =
          voices.find(
            (v) =>
              (v.name.includes("Google") ||
                v.name.includes("Natural") ||
                v.name.includes("Samantha") ||
                v.name.includes("Daniel") ||
                v.name.includes("Karen") ||
                v.name.includes("Arthur")) &&
              v.lang.startsWith("en")
          ) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0];

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => {
        setSpeakingId(id);
      };

      utterance.onend = () => {
        setSpeakingId(null);
      };

      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        setSpeakingId(null);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [speakingId, voices, stop]
  );

  return {
    speak,
    stop,
    speakingId,
    isSpeaking: speakingId !== null,
    supported,
  };
}
