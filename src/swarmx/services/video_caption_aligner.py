from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass(frozen=True)
class WordTiming:
    word: str
    start: float
    end: float
    probability: float


def _format_ass_time(seconds: float) -> str:
    total_cs = max(0, round(seconds * 100))
    hours, remainder = divmod(total_cs, 360000)
    minutes, remainder = divmod(remainder, 6000)
    secs, centis = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def _escape_ass(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", " ")


def align_audio(audio_path: str, language: str = "en", model_size: str = "small") -> list[WordTiming]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(
            "faster-whisper is required for production subtitle alignment; install the video optional dependency"
        ) from exc

    model = WhisperModel(model_size, device="cuda", compute_type="float16")
    segments, _info = model.transcribe(audio_path, language=language, word_timestamps=True, vad_filter=True)
    words: list[WordTiming] = []
    for segment in segments:
        for word in segment.words or []:
            token = word.word.strip()
            if not token:
                continue
            start = float(word.start)
            end = max(start + 0.01, float(word.end))
            words.append(WordTiming(token, start, end, float(word.probability)))
    return words


def build_ass(words: list[WordTiming], style: str = "Kinetic") -> str:
    events = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Kinetic,Arial,64,&H00FFFFFF,&H00000000,&H00101010,&H80000000,1,0,0,0,100,100,0,0,1,4,1,2,70,70,160,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    # Group adjacent words into short readable kinetic chunks. The timestamps
    # remain word-derived; grouping only controls visual density.
    chunk: list[WordTiming] = []
    for word in words:
        chunk.append(word)
        text = " ".join(item.word for item in chunk)
        pause = (word.start - chunk[-2].end) if len(chunk) > 1 else 0.0
        if len(chunk) >= 5 or len(text) >= 34 or pause >= 0.45 or re.search(r"[.!?]$", word.word):
            events.append(
                f"Dialogue: 0,{_format_ass_time(chunk[0].start)},{_format_ass_time(chunk[-1].end)},{style},,0,0,0,,{_escape_ass(text)}"
            )
            chunk = []
    if chunk:
        events.append(
            f"Dialogue: 0,{_format_ass_time(chunk[0].start)},{_format_ass_time(chunk[-1].end)},{style},,0,0,0,,{_escape_ass(' '.join(item.word for item in chunk))}"
        )
    return "\n".join(events) + "\n"


def write_alignment(audio_path: str, ass_path: str, srt_path: str, vtt_path: str, json_path: str) -> None:
    words = align_audio(audio_path)
    Path(ass_path).write_text(build_ass(words), encoding="utf-8")
    payload = [asdict(word) for word in words]
    Path(json_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    chunks: list[tuple[float, float, str]] = []
    for i in range(0, len(words), 6):
        group = words[i:i + 6]
        if group:
            chunks.append((group[0].start, group[-1].end, " ".join(item.word for item in group)))

    def stamp(value: float) -> str:
        h = int(value // 3600)
        m = int((value % 3600) // 60)
        s = value % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}" if s < 10 else f"{h:02d}:{m:02d}:{s:06.3f}"

    srt_lines: list[str] = []
    vtt_lines = ["WEBVTT", ""]
    for idx, (start, end, text) in enumerate(chunks, 1):
        srt_lines += [str(idx), f"{stamp(start).replace('.', ',')} --> {stamp(end).replace('.', ',')}", text, ""]
        vtt_lines += [f"{stamp(start)} --> {stamp(end)}", text, ""]
    Path(srt_path).write_text("\n".join(srt_lines), encoding="utf-8")
    Path(vtt_path).write_text("\n".join(vtt_lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Align synthesized narration with faster-whisper")
    parser.add_argument("audio")
    parser.add_argument("ass")
    parser.add_argument("srt")
    parser.add_argument("vtt")
    parser.add_argument("json")
    args = parser.parse_args()
    write_alignment(args.audio, args.ass, args.srt, args.vtt, args.json)


if __name__ == "__main__":
    main()
