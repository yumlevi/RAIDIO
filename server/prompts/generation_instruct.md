# Music Generation Guidelines — Edit Mode

Given a user's edit request and the previous song data, modify the song to match their expectations.

---

## 1. Prompt (Caption)

The most important input. Combine multiple dimensions for precision:

**Dimensions:** genre, emotion/atmosphere, instruments, timbre texture (warm, crisp, airy, punchy), era reference, production style, vocal characteristics (gender, breathy, raspy, falsetto), tempo feel, structure hints.

**Rules:**
- Specific > vague ("sad piano ballad with female breathy vocal" > "a sad song")
- Combine 3–5 dimensions to anchor the style
- Avoid conflicting styles (e.g. "classical strings" + "hardcore metal")
- Do NOT put BPM/key/time signature in the prompt — use the dedicated fields
- If user references an artist/song name, analyze that style's characteristics and describe those instead of naming the artist

---

## 2. Lyrics

Lyrics are a **temporal script** — they control how the music unfolds over time.

### Structure Tags

| Category | Tags |
|---|---|
| **Core** | `[Intro]` `[Verse]` `[Pre-Chorus]` `[Chorus]` `[Bridge]` `[Outro]` |
| **Dynamic** | `[Build]` `[Drop]` `[Breakdown]` |
| **Instrumental** | `[Instrumental]` `[Guitar Solo]` `[Piano Interlude]` |
| **Special** | `[Fade Out]` `[Silence]` |

### Tag Modifiers

Combine **one** modifier with a hyphen: `[Chorus - anthemic]`, `[Bridge - whispered]`

❌ Don't stack: `[Chorus - anthemic - stacked harmonies - high energy - powerful]`

### Vocal/Energy Tags (inline)

- Vocal: `[raspy vocal]` `[whispered]` `[falsetto]` `[powerful belting]` `[spoken word]` `[harmonies]`
- Energy: `[high energy]` `[building energy]` `[explosive]` `[melancholic]` `[dreamy]`

### Lyric Writing Rules

- **6–10 syllables per line** — keep lines in the same section similar length (±2)
- **UPPERCASE** for high intensity: `WE ARE THE CHAMPIONS!`
- **Parentheses** for background vocals: `We rise together (together)`
- **Blank lines** between sections
- **Consistency:** Caption and Lyrics must not contradict (instruments, emotion, vocal style should align)

### Instrumental Music

If the user requests instrumental, set `lyrics` to an **empty string** `""` — no structure tags, no text.

---

## 3. Metadata

| Field | Range | Notes |
|---|---|---|
| `bpm` | 30–300 | Slow: 60–80, Mid: 90–120, Fast: 130–180 |
| `key_scale` | Any key | Common keys (C, G, D, Am, Em) most reliable |
| `time_signature` | 4/4, 3/4, 6/8 | 4/4 most reliable; 3/4 for waltz; 6/8 for swing |
| `audio_duration` | Seconds | 30–240s most stable |

These are **guidance**, not exact commands. Don't conflict with the prompt (e.g. "slow ballad" + bpm=160).

---

## 4. Decision Logic

1. **Instrumental requested?** → Set `lyrics` to `""` (empty string)
2. **Artist/song referenced?** → Analyze that style's traits; describe them without naming the artist
3. **Vocals?** → Infer gender/style from user prompt and chosen genre
4. Apply only the changes the user requested; preserve the rest from previous data
5. Be creative.

---

## 5. User Edit Request

{prompt}

## Previous Song Data

{previous_data}

---

## 6. Output

Return **only** this JSON object — nothing else:

```json
{
  "song_title": string,
  "prompt": string,        // The caption/style description
  "lyrics": string,        // Empty string for instrumental
  "audio_duration": number,
  "bpm": number,
  "key_scale": string,     // e.g. "C major"
  "time_signature": string // e.g. "4/4"
}
```
