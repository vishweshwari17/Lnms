"""Backfill legacy UUID ticket IDs into the new TKT-based global format.

This script updates the LNMS database in place. It:

1. widens ``tickets.ticket_id`` / ``tickets.correlation_id`` and
   ``incidents.ticket_id`` to safely hold the new identifier format
2. finds legacy tickets whose ``ticket_id`` is a UUID
3. rewrites those IDs to a deterministic ``TKT-...`` value
4. updates dependent tables such as ``ticket_messages`` and ``incidents``
5. preserves the previous UUID in ``correlation_id`` when that field is empty

Usage:

    python3 scripts/backfill_ticket_ids.py --dry-run
    python3 scripts/backfill_ticket_ids.py
"""

import argparse
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
import sys
import uuid

from sqlalchemy import inspect, text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import engine


def is_uuid_like(value: str | None) -> bool:
    if not value:
        return False
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def build_new_ticket_id(
    old_ticket_id: str,
    alarm_id: int | None,
    created_at: datetime | None,
    used_ids: set[str],
) -> str:
    alarm_part = str(alarm_id) if alarm_id is not None else "LEGACY"
    time_part = (created_at or datetime.utcnow()).strftime("%Y%m%d%H%M%S")
    suffix = old_ticket_id.replace("-", "")[:8].upper()
    candidate = f"TKT-{alarm_part}-{time_part}-{suffix}"

    counter = 1
    while candidate in used_ids:
        candidate = f"TKT-{alarm_part}-{time_part}-{suffix}-{counter}"
        counter += 1

    used_ids.add(candidate)
    return candidate


def alter_column_if_needed(conn, table_name: str, column_name: str, target_length: int) -> None:
    inspector = inspect(conn)
    if table_name not in inspector.get_table_names():
        return

    columns = {col["name"]: col for col in inspector.get_columns(table_name)}
    column = columns.get(column_name)
    if not column:
        return

    current_type = column["type"]
    current_length = getattr(current_type, "length", None)
    if current_length is not None and current_length >= target_length:
        return

    conn.execute(
        text(f"ALTER TABLE {table_name} MODIFY COLUMN {column_name} VARCHAR({target_length})")
    )


def get_column_length(conn, table_name: str, column_name: str) -> int | None:
    inspector = inspect(conn)
    if table_name not in inspector.get_table_names():
        return None

    for column in inspector.get_columns(table_name):
        if column["name"] == column_name:
            return getattr(column["type"], "length", None)
    return None


def get_ticket_foreign_keys(conn) -> list[dict]:
    inspector = inspect(conn)
    refs = []
    for table_name in inspector.get_table_names():
        for fk in inspector.get_foreign_keys(table_name):
            if fk.get("referred_table") != "tickets":
                continue
            if "ticket_id" not in (fk.get("referred_columns") or []):
                continue
            refs.append(
                {
                    "table_name": table_name,
                    "name": fk["name"],
                    "constrained_columns": fk["constrained_columns"],
                    "referred_columns": fk["referred_columns"],
                    "options": fk.get("options") or {},
                }
            )
    return refs


def _sql_column_list(columns: list[str]) -> str:
    return ", ".join(columns)


def drop_ticket_foreign_keys(conn, refs: list[dict]) -> None:
    for ref in refs:
        conn.execute(
            text(f"ALTER TABLE {ref['table_name']} DROP FOREIGN KEY {ref['name']}")
        )


def recreate_ticket_foreign_keys(conn, refs: list[dict]) -> None:
    for ref in refs:
        sql = (
            f"ALTER TABLE {ref['table_name']} "
            f"ADD CONSTRAINT {ref['name']} "
            f"FOREIGN KEY ({_sql_column_list(ref['constrained_columns'])}) "
            f"REFERENCES tickets ({_sql_column_list(ref['referred_columns'])})"
        )

        ondelete = ref["options"].get("ondelete")
        onupdate = ref["options"].get("onupdate")
        if ondelete:
            sql += f" ON DELETE {ondelete}"
        if onupdate:
            sql += f" ON UPDATE {onupdate}"

        conn.execute(text(sql))


def ensure_ticket_id_schema(conn, dry_run: bool) -> None:
    ticket_fk_refs = get_ticket_foreign_keys(conn)

    planned_changes = []
    ticket_id_length = get_column_length(conn, "tickets", "ticket_id")
    correlation_length = get_column_length(conn, "tickets", "correlation_id")
    incidents_length = get_column_length(conn, "incidents", "ticket_id")

    if ticket_id_length is not None and ticket_id_length < 64:
        planned_changes.append("tickets.ticket_id -> VARCHAR(64)")
    if correlation_length is not None and correlation_length < 64:
        planned_changes.append("tickets.correlation_id -> VARCHAR(64)")
    if incidents_length is not None and incidents_length < 64:
        planned_changes.append("incidents.ticket_id -> VARCHAR(64)")

    for ref in ticket_fk_refs:
        for column_name in ref["constrained_columns"]:
            child_length = get_column_length(conn, ref["table_name"], column_name)
            if child_length is not None and child_length < 64:
                planned_changes.append(f"{ref['table_name']}.{column_name} -> VARCHAR(64)")

    if dry_run:
        if planned_changes:
            print("Schema changes required before backfill:")
            for change in planned_changes:
                print(f"  {change}")
            if ticket_fk_refs:
                print("Foreign keys that will be temporarily dropped/recreated:")
                for ref in ticket_fk_refs:
                    print(f"  {ref['table_name']}.{','.join(ref['constrained_columns'])} -> tickets.{','.join(ref['referred_columns'])} ({ref['name']})")
        return

    if ticket_fk_refs:
        drop_ticket_foreign_keys(conn, ticket_fk_refs)

    try:
        for ref in ticket_fk_refs:
            for column_name in ref["constrained_columns"]:
                alter_column_if_needed(conn, ref["table_name"], column_name, 64)

        alter_column_if_needed(conn, "tickets", "ticket_id", 64)
        alter_column_if_needed(conn, "tickets", "correlation_id", 64)
        alter_column_if_needed(conn, "incidents", "ticket_id", 64)
    finally:
        if ticket_fk_refs:
            recreate_ticket_foreign_keys(conn, ticket_fk_refs)


def fetch_legacy_tickets(conn) -> list[dict]:
    rows = conn.execute(
        text(
            """
            SELECT ticket_id, alarm_id, created_at, correlation_id
            FROM tickets
            ORDER BY created_at ASC, ticket_id ASC
            """
        )
    ).mappings()

    return [dict(row) for row in rows if is_uuid_like(row["ticket_id"])]


def fetch_existing_ticket_ids(conn) -> set[str]:
    rows = conn.execute(text("SELECT ticket_id FROM tickets")).all()
    return {row[0] for row in rows if row[0]}


def print_plan(rows: Iterable[dict]) -> None:
    print("Planned ticket ID updates:")
    for row in rows:
        print(
            f"  {row['old_ticket_id']} -> {row['new_ticket_id']}"
            f" (alarm_id={row['alarm_id']}, created_at={row['created_at']})"
        )


def backfill_ticket_ids(dry_run: bool = False) -> int:
    with engine.begin() as conn:
        ensure_ticket_id_schema(conn, dry_run=dry_run)

        legacy_rows = fetch_legacy_tickets(conn)
        if not legacy_rows:
            print("No legacy UUID ticket IDs found.")
            return 0

        used_ids = fetch_existing_ticket_ids(conn)
        plan = []

        for row in legacy_rows:
            old_ticket_id = row["ticket_id"]
            used_ids.discard(old_ticket_id)
            new_ticket_id = build_new_ticket_id(
                old_ticket_id=old_ticket_id,
                alarm_id=row.get("alarm_id"),
                created_at=row.get("created_at"),
                used_ids=used_ids,
            )
            plan.append(
                {
                    "old_ticket_id": old_ticket_id,
                    "new_ticket_id": new_ticket_id,
                    "alarm_id": row.get("alarm_id"),
                    "created_at": row.get("created_at"),
                    "correlation_id": row.get("correlation_id"),
                }
            )

        print_plan(plan)

        if dry_run:
            print("Dry run complete. No database changes were committed.")
            return len(plan)

        inspector = inspect(conn)
        has_ticket_messages = "ticket_messages" in inspector.get_table_names()
        has_incidents = "incidents" in inspector.get_table_names()

        for row in plan:
            old_ticket_id = row["old_ticket_id"]
            new_ticket_id = row["new_ticket_id"]
            correlation_id = row["correlation_id"]

            if has_ticket_messages:
                conn.execute(
                    text(
                        """
                        UPDATE ticket_messages
                        SET ticket_id = :new_ticket_id
                        WHERE ticket_id = :old_ticket_id
                        """
                    ),
                    {"new_ticket_id": new_ticket_id, "old_ticket_id": old_ticket_id},
                )

            if has_incidents:
                conn.execute(
                    text(
                        """
                        UPDATE incidents
                        SET ticket_id = :new_ticket_id
                        WHERE ticket_id = :old_ticket_id
                        """
                    ),
                    {"new_ticket_id": new_ticket_id, "old_ticket_id": old_ticket_id},
                )

            conn.execute(
                text(
                    """
                    UPDATE tickets
                    SET ticket_id = :new_ticket_id,
                        correlation_id = CASE
                            WHEN correlation_id IS NULL OR correlation_id = ''
                                THEN :old_ticket_id
                            ELSE correlation_id
                        END
                    WHERE ticket_id = :old_ticket_id
                    """
                ),
                {
                    "new_ticket_id": new_ticket_id,
                    "old_ticket_id": old_ticket_id,
                },
            )

        print(f"Updated {len(plan)} ticket IDs.")
        return len(plan)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned updates and roll back instead of writing changes.",
    )
    args = parser.parse_args()

    backfill_ticket_ids(dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
