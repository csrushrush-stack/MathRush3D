from math import floor


def calculate_run_rewards(
    *,
    actual_math_gain: int,
    distance: float,
    multiplier: int,
    stars: int,
    won: bool,
    bonus_points: int = 0,
) -> dict[str, int]:
    """Keep the server calculation equivalent to shared/gameRules.ts."""
    safe_gain = max(0, actual_math_gain)
    score_value = (
        safe_gain * 20
        + max(0, distance) * 2
        + (500 if won else 0)
        + (multiplier * 175 if won else 0)
        + max(0, bonus_points)
    )
    score = floor(score_value + 0.5)
    coins = 15 + multiplier * 8 + stars * 10 if won else 0
    return {"score": score, "coins": coins}
