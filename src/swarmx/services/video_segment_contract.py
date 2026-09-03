from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict


class VideoSegmentRenderTask(BaseModel):
    """Python representation of contracts/video-segment-render-task.schema.json."""

    model_config = ConfigDict(extra="forbid")

    jobId: str = Field(min_length=1)
    segmentId: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    negativePrompt: str | None = None
    durationSeconds: float = Field(ge=1, le=12)
    fps: int = Field(ge=8, le=30)
    width: int = Field(ge=256, le=1920)
    height: int = Field(ge=256, le=1920)
    seed: int = Field(ge=0)
    referenceImagePath: str | None = None
