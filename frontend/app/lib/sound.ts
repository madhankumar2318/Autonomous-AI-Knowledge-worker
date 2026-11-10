"use client";

/**
 * Sound effects engine for Autonomous AI Knowledge Worker.
 * Uses Web Audio API synthesizers so no external audio assets or network requests are needed.
 * Respects user preferences in localStorage: 'ak_sound_effects' === 'false' means muted.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  // Resume context if browser suspended it due to autoplay policies
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("ak_sound_effects") !== "false";
}

/**
 * ✨ Celestial Crystal Shimmer (AI Response Ready):
 * A smooth, velvety 3-note harmonic cascade (E5 659Hz -> B5 988Hz -> E6 1319Hz).
 * Engineered with gentle attack curves and warm decay to sound luxurious, non-fatiguing, and calm.
 */
export function playAiResponseChime() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note 1: E5 (659.25 Hz) - Warm crystal base
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.14, now + 0.02); // soft attack
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Note 2: B5 (987.77 Hz) - Harmonic shimmer, offset by 45ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.045);
    gain2.gain.setValueAtTime(0.001, now + 0.045);
    gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.045);
    osc2.stop(now + 0.42);

    // Note 3: E6 (1318.51 Hz) - High celestial sparkle, offset by 90ms
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1318.51, now + 0.09);
    gain3.gain.setValueAtTime(0.001, now + 0.09);
    gain3.gain.exponentialRampToValueAtTime(0.09, now + 0.12);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.09);
    osc3.stop(now + 0.5);
  } catch (err) {
    console.debug("[Sound] playAiResponseChime error:", err);
  }
}

/**
 * 🍃 Silk Air Glide (User Message Sent):
 * An ultra-smooth, low-frequency breath (440Hz -> 620Hz) with zero harsh pops or clicks.
 * Feels like whispering a thought into the cloud.
 */
export function playMessageSentSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Smooth, gentle curve
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02); // soft fade in
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // soft fade out
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}

/**
 * 📁 File Upload & RAG Indexing Complete:
 * A clean, bright, elegant bell "ding" (G5 784Hz -> C6 1046.5Hz harmonic with sparkling decay)
 * Plays when a PDF, document, or dataset finishes uploading and indexing into the workspace.
 */
export function playUploadSuccessSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Tone 1: Fundamental Bell (G5 - 783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: Crisp Bright Harmonic (C6 - 1046.50 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1046.5, now + 0.04);
    gain2.gain.setValueAtTime(0.22, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.45);

    // Tone 3: Sparkling High Shimmer (E6 - 1318.51 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1318.51, now + 0.08);
    gain3.gain.setValueAtTime(0.12, now + 0.08);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.08);
    osc3.stop(now + 0.3);
  } catch (err) {
    console.debug("[Sound] playUploadSuccessSound error:", err);
  }
}

/**
 * 🔘 Subtle UI Click / Toggle Tone:
 */
export function playClickSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.04);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {}
}
