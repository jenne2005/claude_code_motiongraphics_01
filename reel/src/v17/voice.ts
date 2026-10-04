/**
 * v1.7 voice: the v1 male voice (Piper en-US Ryan high, v1 chain, pitched down ~1.3 st).
 *
 * NAME_VARIANT picks how lines 2 and 9 say the place (on screen always ADIBATLA):
 *   1 = "Aadi Batla"   2 = "Aa-di Bat-la"   3 = "Aaadi Batla" (stretched first vowel)
 * Switching re-renders only the audio:
 *   python3 scripts/voice_v17.py && python3 scripts/plan_v17.py && python3 scripts/audio_v17.py && bash reel/scripts/render-v17.sh
 */
export const NAME_VARIANT: 1 | 2 | 3 = 1;
