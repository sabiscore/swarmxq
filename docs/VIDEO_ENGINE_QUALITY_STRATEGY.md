# SwarmXQ Viral Video Engine — Quality Strategy

## Product principle

SwarmXQ is a prompt-first short-form video factory, not a generic agent chat application. The system optimizes for a tight creative loop:

`brief → hook → script → shot plan → voice → visual generation → word-timed captions → deterministic assembly → certification → export`

The six-stage pipeline remains immutable. Quality improvements must strengthen an existing stage or a stage boundary rather than create parallel orchestration.

## Creative strategy

### 1. Hook before GPU spend

The highest-leverage creative decision is the first 1–3 seconds. Hook selection should stay CPU-side and use the existing hook laboratory, retention map and virality scorer. Candidate hooks should be evaluated for curiosity gap, specificity, tension, payoff promise and blocklist safety before expensive visual generation is dispatched.

A future approved triage implementation should generate 2–3 candidates, score them deterministically, preserve the chosen candidate in the job provenance, and send only the winning storyboard into GPU rendering.

### 2. One semantic source, many render decisions

The script and storyboard are the semantic source of truth. Renderer prompts may enrich camera, lighting, motion and composition, but must not invent new story facts. This prevents visual polish from causing semantic drift.

### 3. Shot-level visual continuity

Every segment should carry stable job/segment identifiers, deterministic seeds and explicit dimensions. A future visual-anchor pass can add an approved reference frame without changing the renderer contract. Wan2.2 TI2V-5B supports both text and image conditioning and 720p output at 24 fps, making it a suitable first-generation continuity backend.

### 4. Captions follow audio, not prose timing

The synthesized narration is the source of truth for on-screen timing. `faster-whisper` produces word timestamps from the actual WAV; ASS is the production burn-in format and aligned SRT/VTT remain sidecars. Caption presentation should emphasize phrases and meaningful words rather than mechanically highlighting every token.

## Technical strategy

### Remote rendering

The Modal worker is intentionally isolated from the local control plane. Local stages retain the SINGLE-7B and RAM gates. Modal handles segment fan-out only, with four concurrent L4 containers and zero warm containers. Retries belong to the remote function invocation; API-level retries must not duplicate GPU work blindly.

### Determinism

Every render task has:

- stable `jobId` and `segmentId`
- explicit seed
- explicit width/height/fps/duration
- immutable source prompt
- SHA-256 artifact checksum
- renderer/model provenance

The API validates that every requested segment is returned exactly once and reorders artifacts to the original task order before assembly.

### Performance budget

Target the following production budgets:

| Operation | Target |
|---|---:|
| Local hook/script reasoning | bounded by existing stage timeout | 
| Word alignment | cached per audio checksum in a future optimization | 
| Modal cold start + generation | bounded by startup/execution timeout | 
| Remote fan-out | ≤4 concurrent segments | 
| Final FFmpeg assembly | deterministic, one composition pass | 
| Idle GPU | 0 containers | 

Do not introduce a second video renderer merely to optimize one phase.

## Consumer UX strategy

The preferred user journey is:

1. Choose a simple preset or describe an idea.
2. Optionally adjust platform, tone, visual style and duration.
3. Click **Create viral video**.
4. Immediately enter the job timeline.
5. See hook/story/voice/visual/caption/QC stages without exposing infrastructure jargon.
6. Download or review the certified package.

The Video Studio is therefore a thin consumer shell over the canonical video store/API, not an alternate API surface.

## Quality gates

A production render is not considered complete until all of the following are satisfied:

- valid six-stage state transition
- artifact exists and is non-empty
- FFprobe metadata is valid
- audio is present unless an explicitly approved silent fixture path is active
- renderer capability is certified
- template-aware QC passes
- remote segment cardinality and ordering are valid
- caption alignment succeeds when production word alignment is enabled
- final manifest contains renderer/model/voice/caption provenance

## Influenced patterns

The strategy intentionally borrows proven patterns from open-source video systems without copying their architecture wholesale:

- Remotion's caption model demonstrates JSON word/phrase timing and word highlighting as a clean rendering abstraction.
- AutoBroll demonstrates caching a shared transcription, phrase-aware caption pages, anchored captions and a consumer editing loop.
- Wan2.2's official ecosystem emphasizes cinematic control, complex motion, prompt extension and TI2V text/image conditioning.
- Modal's current API provides first-class retries, startup/execution timeouts, secret injection, autoscaling bounds and per-input `Function.map()` retry behavior.

## Deferred enhancements

These remain opt-in and must not silently become production dependencies:

- 2–3 hook variant tournament before GPU spend
- reference-frame visual anchoring
- WhisperX forced alignment upgrade
- curated SFX and loudness normalization
- libvmaf objective quality gate
- local Grafana Tempo tracing

## References

- https://github.com/Wan-Video/Wan2.2
- https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B-Diffusers
- https://github.com/remotion-dev/remotion
- https://github.com/andriidrok1/autobroll
- https://modal.com/docs/sdk/py/latest/App
- https://modal.com/docs/guide/retries
