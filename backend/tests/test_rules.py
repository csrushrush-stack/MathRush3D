import pytest

from backend.app.rules import calculate_run_rewards
from backend.app.schemas import FeedbackCreate, SkinCreate
from backend.app.security import hash_password, hash_token, new_reset_token, token_expired, verify_password


def test_run_rewards_match_the_existing_game_rule_for_a_win():
    assert calculate_run_rewards(
        actual_math_gain=12,
        distance=100,
        multiplier=3,
        stars=2,
        won=True,
        bonus_points=25,
    ) == {"score": 1490, "coins": 59}


def test_loss_does_not_award_win_coins_or_negative_math_score():
    assert calculate_run_rewards(
        actual_math_gain=-4,
        distance=10,
        multiplier=5,
        stars=3,
        won=False,
    ) == {"score": 20, "coins": 0}


def test_feedback_rejects_short_messages():
    with pytest.raises(ValueError):
        FeedbackCreate(category="bug", message="Too short")


def test_skin_requires_valid_hex_colors_and_safe_price():
    with pytest.raises(ValueError):
        SkinCreate(
            id="spark",
            name="Spark",
            primaryColor="red",
            secondaryColor="#000000",
            accentColor="#000000",
            headColor="#000000",
            glowColor="#000000",
            price=-1,
            rarity="Rare",
        )


def test_password_is_hashed_and_only_the_matching_password_verifies():
    encoded = hash_password("correct horse battery staple")
    assert encoded != "correct horse battery staple"
    assert verify_password("correct horse battery staple", encoded)
    assert not verify_password("incorrect password", encoded)


def test_reset_tokens_are_random_fixed_length_and_stored_as_hashes():
    token = new_reset_token()
    assert len(token) == 64
    assert hash_token(token) != token
    assert hash_token(token) == hash_token(token)


def test_reset_expiry_uses_utc_and_rejects_old_tokens():
    from datetime import datetime, timezone

    assert token_expired(datetime(2020, 1, 1, tzinfo=timezone.utc))
    assert not token_expired(datetime(2099, 1, 1, tzinfo=timezone.utc))
