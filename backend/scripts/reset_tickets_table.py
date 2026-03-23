"""Utility to drop/recreate the *tickets* table using the current SQLAlchemy model.

This is handy during development when the Python model has been modified
but the existing MySQL table still reflects the old schema.  It simply
drops the legacy table (losing any data that was stored there) and then
runs ``create`` for the :class:`~app.models.tickets.Ticket` table so that
it matches the attributes defined in the model.

Run it from the workspace root like:

    $ python3 scripts/reset_tickets_table.py

or import/execute it from an interactive shell.  **Do not** execute this
on a production database unless you really mean to remove the old data.
"""

from app.database import engine
from app.models.tickets import Ticket
from sqlalchemy import text


def main():
    # MySQL won't let us drop the tickets table if other tables reference
    # it via foreign key constraints.  the legacy schema appears to have
    # at least one such constraint, so we temporarily disable enforcement
    # and clean up first.
    with engine.connect() as conn:
        print("disabling foreign key checks")
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
        # legacy tables still exist in the database and enforce FKs to
        # the old tickets table.  drop them as well so our new schema can
        # be created cleanly.  this intentionally destroys any historic
        # ticket-related content in these tables.
        for tbl in ("chat_messages", "ticket_comments", "ticket_images"):
            print(f"dropping legacy table {tbl} (if present)")
            conn.execute(text(f"DROP TABLE IF EXISTS {tbl};"))

        print("dropping tickets table (if present)")
        conn.execute(text("DROP TABLE IF EXISTS tickets;"))
        print("re-enabling foreign key checks")
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))

    # recreate using current model definition
    print("creating tickets table using current SQLAlchemy model")
    Ticket.__table__.create(bind=engine, checkfirst=True)


if __name__ == "__main__":
    main()
