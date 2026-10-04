/**
 * v1.6 voice (the v1 male voice: Piper en-US Ryan high, pitched down ~1.3 semitones, v1 chain).
 *
 * NAME_VARIANT picks how lines 2 and 9 pronounce the place (on screen it is always ADIBATLA):
 *   1 = "Aadi Batla"   2 = "Aa-di Bat-la"   3 = "Aaadi Batla" (stretched first vowel)
 * Switching it re-renders only the audio:
 *   python3 scripts/voice_v16.py && python3 scripts/audio_v16.py && bash reel/scripts/render-v16.sh
 */
export const NAME_VARIANT: 1 | 2 | 3 = 1;
