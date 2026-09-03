"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useVideoStore } from "../../../../stores/video";
import type { VideoJobRequest } from "../../../../lib/video-dashboard";

const PRESETS = [
  { id: "fact", label: "Fact Drop", prompt: "Turn one surprising fact into a fast, high-retention short with a strong curiosity gap.", style: "faceless_broll", tone: "educational" },
  { id: "myth", label: "Myth Bust", prompt: "Bust a common myth with a sharp hook, 3 proof beats, and a memorable conclusion.", style: "kinetic_text", tone: "contrarian" },
  { id: "story", label: "Storytime", prompt: "Tell a compact story with a cold open, escalating beats, visual changes, and payoff.", style: "storytime", tone: "cinematic" },
  { id: "list", label: "Countdown", prompt: "Create a countdown with escalating value, fast visual beats, and a strong final reveal.", style: "faceless_broll", tone: "urgent" },
] as const;

export default function VideoStudioPage() {
  const router = useRouter();
  const submitJob = useVideoStore((state) => state.submitJob);
  const submitError = useVideoStore((state) => state.submitError);
  const isSubmitting = useVideoStore((state) => state.isSubmitting);
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<VideoJobRequest["tone"]>("educational");
  const [style, setStyle] = useState<VideoJobRequest["style"]>("faceless_broll");
  const [platform, setPlatform] = useState<VideoJobRequest["platform"]>("tiktok");
  const [duration, setDuration] = useState(30);

  const ready = useMemo(() => prompt.trim().length >= 8 && !isSubmitting, [prompt, isSubmitting]);

  function usePreset(preset: (typeof PRESETS)[number]) {
    setPrompt(preset.prompt);
    setStyle(preset.style);
    setTone(preset.tone);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const request: VideoJobRequest = {
      prompt: prompt.trim(),
      platform: platform ?? "tiktok",
      tone: tone ?? "educational",
      style: style ?? "faceless_broll",
      targetDurationSeconds: duration,
      captionStyle: "bold_center",
    };
    const createdJobId = await submitJob(request);
    if (createdJobId) router.push(`/video/${encodeURIComponent(createdJobId)}`);
  }

  return (
    <main className="min-h-screen bg-bg text-text-primary px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.22em] text-accent">SwarmX Video Studio</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Describe the idea. SwarmX builds the short.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Start from a concept or preset. The existing pipeline handles hook mechanics, scripting, storyboarding, voice, rendering, captions and certification.</p>
          </div>
          <a href="/video" className="text-xs font-mono text-text-muted underline-offset-4 hover:text-accent hover:underline">Open video jobs</a>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <form onSubmit={submit} className="rounded-2xl border border-border-active bg-bg-elevated/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)] md:p-6">
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted" htmlFor="video-prompt">What should the video be about?</label>
            <textarea id="video-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Example: Explain why sleep debt changes reaction time using a surprising opening and 3 visual proof beats." rows={7} className="mt-3 w-full resize-none rounded-xl border border-border bg-bg px-4 py-4 text-sm leading-6 outline-none transition focus:border-accent" />

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PRESETS.map((preset) => (
                <button type="button" key={preset.id} onClick={() => usePreset(preset)} className="rounded-xl border border-border bg-bg/70 px-3 py-3 text-left text-xs text-text-secondary transition hover:border-border-active hover:text-text-primary">
                  <span className="block font-medium text-text-primary">{preset.label}</span>
                  <span className="mt-1 block leading-5">{preset.prompt}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Field label="Platform"><select value={platform} onChange={(e) => setPlatform(e.target.value as VideoJobRequest["platform"])} className="control"><option value="tiktok">TikTok</option><option value="reels">Instagram Reels</option><option value="shorts">YouTube Shorts</option><option value="generic">Generic</option></select></Field>
              <Field label="Tone"><select value={tone} onChange={(e) => setTone(e.target.value as VideoJobRequest["tone"])} className="control"><option value="educational">Educational</option><option value="urgent">Urgent</option><option value="contrarian">Contrarian</option><option value="cinematic">Cinematic</option><option value="warm">Warm</option><option value="minimal">Minimal</option></select></Field>
              <Field label="Visual style"><select value={style} onChange={(e) => setStyle(e.target.value as VideoJobRequest["style"])} className="control"><option value="faceless_broll">Faceless b-roll</option><option value="kinetic_text">Kinetic text</option><option value="storytime">Storytime</option><option value="tutorial">Tutorial</option><option value="myth_busting">Myth busting</option></select></Field>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-bg/50 p-4 md:flex-row md:items-center md:justify-between">
              <div><p className="text-xs font-medium">Target duration</p><p className="text-[11px] text-text-muted">15–90 seconds in Studio. The pipeline supports longer jobs through the main form.</p></div>
              <div className="flex items-center gap-3"><input aria-label="Target duration" type="range" min={15} max={90} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-40" /><span className="w-12 text-right font-mono text-xs">{duration}s</span></div>
            </div>

            <button disabled={!ready} className="mt-6 w-full rounded-xl bg-accent px-5 py-3.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" type="submit">{isSubmitting ? "Queueing video…" : "Create viral video"}</button>
            {submitError && <div className="mt-4 rounded-xl border border-status-error/35 bg-status-error/10 p-4 text-sm text-status-error" role="alert">{submitError}</div>}
          </form>

          <aside className="rounded-2xl border border-border bg-bg-elevated/60 p-5">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">Production flow</p>
            <div className="mt-5 space-y-4">
              {[
                ["01", "Hook", "Curiosity, contrast and open-loop mechanics before GPU spend."],
                ["02", "Story", "Compact beats with a clear escalation and payoff."],
                ["03", "Voice", "Existing Kokoro/Piper/eSpeak provider routing."],
                ["04", "Visuals", "Remote L4 generation or certified local render path."],
                ["05", "Captions", "Audio-derived word timing for production subtitle alignment."],
                ["06", "QC", "Artifact, media, template and publication gates."],
              ].map(([n, title, body]) => <div key={n} className="flex gap-3"><span className="mt-0.5 font-mono text-xs text-accent">{n}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-text-muted">{body}</p></div></div>)}
            </div>
          </aside>
        </section>
      </div>
      <style jsx>{`.control{width:100%;margin-top:.5rem;border-radius:.75rem;border:1px solid var(--color-border);background:var(--color-bg);padding:.7rem .8rem;font-size:.8rem;outline:none}.control:focus{border-color:var(--color-accent)}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-mono text-text-muted">{label}{children}</label>;
}
