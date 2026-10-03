/**
 * Voice settings for ReelV4.
 *
 * NAME_VARIANT picks how the VO pronounces the location (on screen it is always ADIBATLA):
 *   1 = "Aadi Batla"   2 = "Aa-di Bat-la"   3 = "Aaadi Batla"
 * Changing it only re-renders the audio:
 *   python3 scripts/voice_v4.py && python3 scripts/audio_v4.py   (then re-render the MP4s)
 */
export const NAME_VARIANT: 1 | 2 | 3 = 1;

export const VOICE = {
  engine: "kokoro-onnx v1.0",
  blend: { af_nicole: 0.65, af_heart: 0.35 },
  speed: 0.93,
} as const;
