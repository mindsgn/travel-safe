from datetime import timedelta

import pytest

from deadman.switch import compute_deadline, is_expired, seconds_remaining, validate_interval
from tests.conftest import START


def test_deadline_is_last_check_in_plus_interval():
    assert compute_deadline(START, 7) == START + timedelta(days=7)


@pytest.mark.parametrize("days", [1, 2, 3, 7, 14, 30, 60, 90, 180, 365])
def test_supported_presets_are_valid(days):
    assert validate_interval(days) == days


@pytest.mark.parametrize("days", [0, -1, 366])
def test_out_of_range_intervals_are_rejected(days):
    with pytest.raises(ValueError):
        validate_interval(days)


def test_not_expired_before_deadline():
    deadline = compute_deadline(START, 1)
    assert not is_expired(deadline, deadline - timedelta(seconds=1))


def test_not_expired_exactly_at_deadline():
    deadline = compute_deadline(START, 1)
    assert not is_expired(deadline, deadline)


def test_expired_after_deadline():
    deadline = compute_deadline(START, 1)
    assert is_expired(deadline, deadline + timedelta(microseconds=1))


def test_no_deadline_never_expires():
    assert not is_expired(None, START)
    assert seconds_remaining(None, START) is None


def test_seconds_remaining_goes_negative_after_deadline():
    deadline = START + timedelta(hours=1)
    assert seconds_remaining(deadline, START) == 3600
    assert seconds_remaining(deadline, START + timedelta(hours=2)) == -3600
