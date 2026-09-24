import sqlite3

from deadman import worker
from deadman.db import MIGRATIONS


def test_worker_once_runs_a_full_pass(tmp_path, monkeypatch):
    db_path = tmp_path / "worker.db"
    monkeypatch.setenv("DEADMAN_DB_PATH", str(db_path))
    worker.main(["--once"])
    version = sqlite3.connect(db_path).execute("PRAGMA user_version").fetchone()[0]
    assert version == len(MIGRATIONS)


def test_run_once_report_is_empty_without_work(run_worker):
    report = run_worker()
    assert report.triggered_events == []
    assert report.dispatch.sent == []
    assert report.cleanup.profiles_purged == 0
