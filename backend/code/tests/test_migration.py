from deadman.db import MIGRATIONS, migrate, open_connection

NOW = "2026-01-10T09:00:00+00:00"


def _old_schema_db(tmp_path):
    """A database at version 1 (the schema before SMS was removed), with data."""
    connection = open_connection(str(tmp_path / "old.db"))
    connection.executescript(f"BEGIN;\n{MIGRATIONS[0]}\nPRAGMA user_version = 1;\nCOMMIT;")

    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(
        """
        INSERT INTO users (id, name, timezone, account_key_hash, check_in_interval_days,
                           switch_state, created_at, updated_at)
        VALUES ('u1', 'Thandi', NULL, 'hash', 1, 'triggered', ?, ?)
        """,
        (NOW, NOW),
    )
    connection.execute(
        """
        INSERT INTO deadman_events (id, user_id, deadline_at, triggered_at, status, location_purge_after)
        VALUES ('e1', 'u1', ?, ?, 'triggered', ?)
        """,
        (NOW, NOW, "2026-02-10T09:00:00+00:00"),
    )
    connection.execute(
        """
        INSERT INTO emergency_contacts (id, user_id, name, email, phone, whatsapp, created_at, updated_at)
        VALUES ('c1', 'u1', 'Sipho', 'sipho@example.com', NULL, 0, ?, ?),
               ('c2', 'u1', 'Nomsa', NULL, '+27821234567', 0, ?, ?)
        """,
        (NOW, NOW, NOW, NOW),
    )

    def _notification(notification_id: str, contact_id: str, channel: str, recipient: str) -> None:
        connection.execute(
            """
            INSERT INTO notification_events (id, deadman_event_id, contact_id, notification_type, channel,
                                             recipient, recipient_name, status, retryable, attempts,
                                             created_at, updated_at)
            VALUES (?, 'e1', ?, 'emergency_alert', ?, ?, ?, 'sent', 1, 1, ?, ?)
            """,
            (notification_id, contact_id, channel, recipient, "Sipho", NOW, NOW),
        )

    _notification("n1", "c1", "email", "sipho@example.com")
    _notification("n2", "c2", "sms", "+27821234567")

    connection.execute(
        """
        INSERT INTO emergency_links (id, deadman_event_id, notification_event_id, token_hash, created_at, expires_at)
        VALUES ('l1', 'e1', 'n1', 'tok-email', ?, ?), ('l2', 'e1', 'n2', 'tok-sms', ?, ?)
        """,
        (NOW, NOW, NOW, NOW),
    )
    return connection


def test_migration_removes_sms_channel_and_detaches_its_links(tmp_path):
    connection = _old_schema_db(tmp_path)
    try:
        migrate(connection)
        channels = [row["channel"] for row in connection.execute("SELECT channel FROM notification_events")]
        assert channels == ["email"]
        links = connection.execute(
            "SELECT notification_event_id FROM emergency_links WHERE id = 'l2'"
        ).fetchone()
        assert links["notification_event_id"] is None
        kept = connection.execute(
            "SELECT notification_event_id FROM emergency_links WHERE id = 'l1'"
        ).fetchone()
        assert kept["notification_event_id"] == "n1"
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
    finally:
        connection.close()


def test_sms_is_rejected_after_migration(tmp_path):
    connection = _old_schema_db(tmp_path)
    try:
        migrate(connection)
        connection.execute("BEGIN")
        try:
            connection.execute(
                """
                INSERT INTO notification_events (id, deadman_event_id, contact_id, notification_type, channel,
                                                 recipient, recipient_name, status, retryable, attempts,
                                                 created_at, updated_at)
                VALUES ('n3', 'e1', 'c2', 'emergency_alert', 'sms', '+27821234567', 'Nomsa',
                        'pending', 1, 0, ?, ?)
                """,
                (NOW, NOW),
            )
        finally:
            connection.execute("ROLLBACK")
        raise AssertionError("expected the sms channel to be rejected by the new CHECK constraint")
    except Exception as error:
        assert "CHECK constraint failed" in str(error)
    finally:
        connection.close()