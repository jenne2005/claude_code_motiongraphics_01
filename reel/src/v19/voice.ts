/**
 * v1.9 voice: a completely new voice on every line (Kokoro am_michael, offline), "TCS" said naturally.
 *
 * NAME_VARIANT picks how lines 2 and 9 say the place (on screen always ADIBATLA):
 *   1 = "Aadi Batla"   2 = "Aa-di Bat-la"   3 = "Aaadi But-laa" (phoneme-level reading)
 * Switching re-renders only the audio:
 *   python3 scripts/voice_v19.py && python3 scripts/plan_v19.py && python3 scripts/audio_v19.py && bash reel/scripts/render-v19.sh
 */
export const NAME_VARIANT: 1 | 2 | 3 = 1;
