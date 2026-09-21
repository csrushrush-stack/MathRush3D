import re
from typing import Literal
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def camel_case(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=camel_case,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


Difficulty = Literal["easy", "medium", "hard", "expert"]
SkinRarity = Literal["Starter", "Common", "Rare", "Epic", "Legendary"]
HexColor = str


class RegisterRequest(ApiModel):
    display_name: str = Field(min_length=2, max_length=32)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    device_id: str = Field(min_length=16, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()


class LoginRequest(ApiModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()


class ForgotPasswordRequest(ApiModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()


class ResetPasswordRequest(ApiModel):
    token: str = Field(pattern=r"^[a-f0-9]{64}$")
    password: str = Field(min_length=8, max_length=128)


class PlayerSessionRequest(ApiModel):
    device_id: str = Field(min_length=16, max_length=128)
    display_name: str | None = Field(default=None, min_length=1, max_length=32)


class SettingsRequest(ApiModel):
    music: bool | None = None
    sound_effects: bool | None = None
    vibration: bool | None = None
    notifications: bool | None = None
    reduced_effects: bool | None = None


class ProgressRequest(ApiModel):
    selected_difficulty: Difficulty
    selected_level: int | None = Field(default=None, ge=1, le=5)


class GateEvent(ApiModel):
    gate_index: int = Field(ge=0, le=9)
    world_z: float = Field(ge=-1000, le=0)
    left_expression: str = Field(min_length=1, max_length=24)
    right_expression: str = Field(min_length=1, max_length=24)
    chosen_side: Literal["left", "right"]
    chosen_delta: int = Field(ge=-1000, le=1000)
    optimal_delta: int = Field(ge=-1000, le=1000)
    crowd_before: int = Field(ge=0, le=10000)
    crowd_after: int = Field(ge=0, le=10000)


class ObstacleEvent(ApiModel):
    obstacle_index: int = Field(ge=0, le=20)
    world_z: float = Field(ge=-1000, le=0)
    obstacle_type: Literal["wall", "blocker", "enemy", "hammer", "cones", "pit", "spinner", "crusher"]
    outcome: Literal["hit", "dodged", "defeated"]
    crowd_before: int = Field(ge=0, le=10000)
    crowd_after: int = Field(ge=0, le=10000)
    damage: int = Field(ge=0, le=10000)


class RunRequest(ApiModel):
    client_run_id: UUID
    player_id: UUID
    difficulty: Difficulty
    level: int = Field(ge=1, le=5)
    status: Literal["won", "lost"]
    started_at: datetime
    ended_at: datetime
    distance: float = Field(ge=0, le=10000)
    starting_crowd: int = Field(ge=1, le=100)
    crowd_at_boss: int = Field(ge=0, le=10000)
    ending_crowd: int = Field(ge=0, le=10000)
    boss_health: int = Field(ge=0, le=10000)
    multiplier: int = Field(ge=1, le=10)
    stars: int = Field(ge=0, le=3)
    math_gain: int = Field(ge=-10000, le=10000)
    max_math_gain: int = Field(ge=0, le=10000)
    bonus_points: int = Field(default=0, ge=0, le=1000000)
    client_version: str = Field(default="dev", max_length=32)
    gate_events: list[GateEvent] = Field(default_factory=list, max_length=10)
    obstacle_events: list[ObstacleEvent] = Field(default_factory=list, max_length=30)


class FeedbackCreate(ApiModel):
    category: Literal["bug", "idea", "other"]
    message: str = Field(min_length=10, max_length=2000)


class FeedbackUpdate(ApiModel):
    status: Literal["new", "reviewing", "accepted", "declined", "resolved"] | None = None
    admin_note: str | None = Field(default=None, max_length=1000)


class SkinCreate(ApiModel):
    id: str = Field(pattern=r"^[a-z0-9_-]{2,32}$")
    name: str = Field(min_length=2, max_length=40)
    primary_color: HexColor
    secondary_color: HexColor
    accent_color: HexColor
    head_color: HexColor
    glow_color: HexColor
    price: int = Field(ge=0, le=100000)
    rarity: SkinRarity
    sort_order: int = Field(default=0, ge=0, le=1000)
    is_available: bool = True

    @field_validator("primary_color", "secondary_color", "accent_color", "head_color", "glow_color")
    @classmethod
    def valid_color(cls, value: str) -> str:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Use a six-digit hexadecimal colour such as #22aaff")
        return value.lower()


class SkinUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=2, max_length=40)
    primary_color: HexColor | None = None
    secondary_color: HexColor | None = None
    accent_color: HexColor | None = None
    head_color: HexColor | None = None
    glow_color: HexColor | None = None
    price: int | None = Field(default=None, ge=0, le=100000)
    rarity: SkinRarity | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)
    is_available: bool | None = None

    @field_validator("primary_color", "secondary_color", "accent_color", "head_color", "glow_color")
    @classmethod
    def valid_color(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Use a six-digit hexadecimal colour such as #22aaff")
        return value.lower() if value else value


class PlayerUpdate(ApiModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=32)
    is_active: bool | None = None


class AdminGrantRequest(ApiModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()
