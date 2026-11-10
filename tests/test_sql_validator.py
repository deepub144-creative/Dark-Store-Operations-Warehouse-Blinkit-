"""Unit tests for Read-Only Text-to-SQL Validator, SQL injection blocks, and RBAC rules."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.sql_engine import SQLValidationError, execute_safe_sql, run_nl_to_sql, validate_read_only_sql
from data.seed_db import seed_database


def test_allows_valid_select_and_with_cte() -> None:
    sql = 'WITH top_skus AS (SELECT product_id, SUM(quantity) AS q FROM Order_Item GROUP BY product_id) SELECT p.name, t.q FROM top_skus t JOIN Product p ON t.product_id = p.product_id'
    validated = validate_read_only_sql(sql, user_role="Admin")
    assert "LIMIT 25" in validated

    capped = validate_read_only_sql('SELECT order_id FROM "Order" LIMIT 999', user_role="Admin")
    assert capped.endswith("LIMIT 100")


@pytest.mark.parametrize(
    "bad_sql",
    [
        "DROP TABLE Product",
        'DELETE FROM "Order" WHERE 1=1',
        "INSERT INTO Staff VALUES ('x')",
        "UPDATE Inventory SET qty_available = 999",
        "SELECT * FROM Product; DROP TABLE Darkstore",
        "SELECT * FROM Product -- bypass limit",
        "SELECT * FROM Product /* comment */",
        "PRAGMA table_info(Staff)",
        "SELECT * FROM sqlite_master",
        "SELECT * FROM Secret_Backdoor_Table",
    ],
)
def test_blocks_destructive_or_non_whitelisted_sql(bad_sql: str) -> None:
    with pytest.raises(SQLValidationError):
        validate_read_only_sql(bad_sql, user_role="Admin")


def test_rbac_table_and_column_enforcement(tmp_path: Path) -> None:
    db_file = tmp_path / "rbac.db"
    seed_database(db_file, force_reset=True)

    # Customer cannot read Shrinkage_Dump_Log or cost_price
    with pytest.raises(SQLValidationError):
        validate_read_only_sql("SELECT * FROM Shrinkage_Dump_Log", user_role="Customer")
    with pytest.raises(SQLValidationError):
        validate_read_only_sql("SELECT name, cost_price FROM Product", user_role="Customer")

    # Rider cannot query Demand_Forecast
    with pytest.raises(SQLValidationError):
        validate_read_only_sql("SELECT * FROM Demand_Forecast", user_role="Rider")

    # Store Staff CAN read Shrinkage_Dump_Log, Inventory, Product
    res = execute_safe_sql(
        "SELECT reason, COUNT(*) AS cnt FROM Shrinkage_Dump_Log GROUP BY reason",
        user_role="Store Staff",
        db_path=db_file,
    )
    assert res.row_count >= 1


def test_nl_to_sql_end_to_end(tmp_path: Path) -> None:
    db_file = tmp_path / "nl2sql.db"
    seed_database(db_file, force_reset=True)

    res = run_nl_to_sql("Top 5 products this week", user_role="Admin", db_path=db_file)
    assert res.blocked_reason is None
    assert 1 <= res.row_count <= 5
    assert "units_sold" in res.columns

    # Customer requesting shrinkage report must be cleanly blocked by RBAC
    blocked = run_nl_to_sql("Show shrinkage dump loss report", user_role="Customer", db_path=db_file)
    assert blocked.blocked_reason is not None
    assert blocked.row_count == 0

