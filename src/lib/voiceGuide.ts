/**
 * Voice Guide - Text-to-Speech helper for construction workers.
 * Uses the native Web Speech Synthesis API to read instructions aloud in Spanish.
 */

let voiceEnabled = false;

export function setVoiceEnabled(enabled: boolean) {
  voiceEnabled = enabled;
  if (!enabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceEnabled() {
  return voiceEnabled;
}

export function speak(text: string) {
  if (!voiceEnabled) return;
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-AR';
  utterance.rate = 0.9;  // Slightly adjusted speed
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a high quality Spanish voice
  const voices = window.speechSynthesis.getVoices();
  const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
  
  // Prioritize Google, Natural or regional voices (Argentina/Mexico) which sound much better
  const premiumVoice = spanishVoices.find(v => 
    v.name.includes('Google') || 
    v.name.includes('Natural') || 
    v.name.includes('Siri') ||
    v.lang === 'es-AR' || 
    v.lang === 'es-MX'
  );
  
  const selectedVoice = premiumVoice || spanishVoices[0];
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}
