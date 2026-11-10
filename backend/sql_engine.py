"""Read-Only Text-to-SQL Generator & Strict Security Validator over the 12 Audit-X ER entities."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.database import get_connection
from backend.security import ROLE_RESTRICTED_COLUMNS, ROLE_TABLE_PERMISSIONS, UserRole, normalize_role

MAX_SQL_LIMIT = 100
DEFAULT_SQL_LIMIT = 25

DANGEROUS_KEYWORDS = {
    "drop", "delete", "update", "insert", "replace", "alter", "create",
    "attach", "detach", "pragma", "vacuum", "reindex", "truncate",
    "grant", "revoke", "exec", "execute", "into", "merge", "call",
}

ALL_ER_TABLES = {
    "darkstore", "staff", "customer", "product", "inventory", "rider",
    "order", "order_item", "delivery", "demand_forecast",
    "shrinkage_dump_log", "rag_query_log",
}

TABLE_CANONICAL_NAMES: dict[str, str] = {
    "darkstore": "Darkstore",
    "staff": "Staff",
    "customer": "Customer",
    "product": "Product",
    "inventory": "Inventory",
    "rider": "Rider",
    "order": '"Order"',
    "order_item": "Order_Item",
    "delivery": "Delivery",
    "demand_forecast": "Demand_Forecast",
    "shrinkage_dump_log": "Shrinkage_Dump_Log",
    "rag_query_log": "Rag_Query_Log",
}


class SQLValidationError(ValueError):
    """Raised when generated or supplied SQL violates read-only, table-whitelist, or RBAC policy."""


@dataclass(slots=True)
class SQLQueryResult:
    sql: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    latency_ms: int
    topic: str
    blocked_reason: str | None = None


def _strip_string_literals(sql: str) -> str:
    return re.sub(r"'(?:''|[^'])*'", "''", sql)


def _extract_cte_names(sql_no_strings: str) -> set[str]:
    cte_names: set[str] = set()
    if not re.match(r"^\s*with\b", sql_no_strings, flags=re.IGNORECASE):
        return cte_names
    for m in re.finditer(r"(?:\bwith|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(", sql_no_strings, flags=re.IGNORECASE):
        cte_names.add(m.group(1).lower())
    return cte_names


def _extract_referenced_tables(sql_no_strings: str) -> set[str]:
    refs: set[str] = set()
    pattern = re.compile(
        r"\b(?:from|join)\s+(?:\"([a-zA-Z_][a-zA-Z0-9_]*)\"|`([a-zA-Z_][a-zA-Z0-9_]*)`|([a-zA-Z_][a-zA-Z0-9_]*))",
        flags=re.IGNORECASE,
    )
    for m in pattern.finditer(sql_no_strings):
        name = (m.group(1) or m.group(2) or m.group(3) or "").strip().lower()
        if name:
            refs.add(name)
    return refs


def validate_read_only_sql(sql: str, user_role: str | UserRole = UserRole.ADMIN) -> str:
    """Validate and normalize a read-only SELECT query against schema whitelist & RBAC rules."""
    role = normalize_role(user_role) if isinstance(user_role, str) else user_role
    cleaned = sql.strip().rstrip(";").strip()
    if not cleaned:
        raise SQLValidationError("Empty SQL query.")

    # Reject inline SQL comments used in smuggling attacks
    if "--" in _strip_string_literals(cleaned) or "/*" in _strip_string_literals(cleaned):
        raise SQLValidationError("SQL comments (-- or /* */) are disallowed by read-only validator.")

    no_strings = _strip_string_literals(cleaned)

    # Reject stacked statements containing internal semicolons
    if ";" in no_strings:
        raise SQLValidationError("Multiple SQL statements detected; only single SELECT queries are allowed.")

    # Must begin with SELECT or WITH
    if not re.match(r"^(select|with)\b", no_strings, flags=re.IGNORECASE):
        raise SQLValidationError("Only read-only SELECT (or WITH ... SELECT) statements are permitted.")

    # Scan identifier words outside strings against destructive keywords
    words = set(re.findall(r"\b[a-zA-Z_]+\b", no_strings.lower()))
    blocked = words & DANGEROUS_KEYWORDS
    if blocked:
        raise SQLValidationError(f"Disallowed SQL keyword(s) detected: {', '.join(sorted(blocked))}")

    # Enforce ER table whitelist and per-role RBAC scope
    cte_names = _extract_cte_names(no_strings)
    referenced = _extract_referenced_tables(no_strings) - cte_names
    if not referenced:
        raise SQLValidationError("Query must reference at least one valid Audit-X ER table.")

    unknown_tables = referenced - ALL_ER_TABLES
    if unknown_tables:
        raise SQLValidationError(f"Non-whitelisted table(s): {', '.join(sorted(unknown_tables))}")

    allowed_for_role = ROLE_TABLE_PERMISSIONS[role]
    forbidden_for_role = referenced - allowed_for_role
    if forbidden_for_role:
        readable = ", ".join(TABLE_CANONICAL_NAMES[t] for t in sorted(forbidden_for_role))
        raise SQLValidationError(
            f"Role '{role.value}' does not have permission to query: {readable}."
        )

    # Column-level redaction guard for non-Admin roles
    restricted_cols = ROLE_RESTRICTED_COLUMNS.get(role, set())
    for col in restricted_cols:
        if re.search(rf"\b{re.escape(col)}\b", no_strings, flags=re.IGNORECASE):
            raise SQLValidationError(
                f"Role '{role.value}' cannot access restricted column '{col}'."
            )

    # Enforce row limit cap (<= MAX_SQL_LIMIT)
    limit_match = re.search(r"\blimit\s+(\d+)\b", no_strings, flags=re.IGNORECASE)
    if limit_match:
        requested_limit = int(limit_match.group(1))
        if requested_limit > MAX_SQL_LIMIT:
            cleaned = re.sub(
                r"\blimit\s+\d+\b",
                f"LIMIT {MAX_SQL_LIMIT}",
                cleaned,
                count=1,
                flags=re.IGNORECASE,
            )
    else:
        cleaned = f"{cleaned} LIMIT {DEFAULT_SQL_LIMIT}"

    return cleaned


def execute_safe_sql(
    sql: str,
    user_role: str | UserRole = UserRole.ADMIN,
    db_path: Path | None = None,
    topic: str = "custom_query",
) -> SQLQueryResult:
    """Validate and execute read-only SQL safely on a read-only SQLite connection."""
    t0 = time.perf_counter()
    safe_sql = validate_read_only_sql(sql, user_role=user_role)
    with get_connection(db_path=db_path, read_only=True) as conn:
        cur = conn.execute(safe_sql)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    elapsed = max(1, int((time.perf_counter() - t0) * 1000))
    return SQLQueryResult(
        sql=safe_sql,
        columns=cols,
        rows=rows,
        row_count=len(rows),
        latency_ms=elapsed,
        topic=topic,
    )


def plan_sql_from_question(question: str, user_role: str | UserRole = UserRole.ADMIN) -> tuple[str, str]:
    """Map natural-language warehouse/analytics questions into schema-accurate read-only SQL."""
    role = normalize_role(user_role) if isinstance(user_role, str) else user_role
    q = question.lower()

    # Check store filter
    store_filter = ""
    if "tiptur" in q or "ka44" in q:
        store_filter = " AND d.hub_code = 'KA44'"
    elif "tumkur" in q or "ka06" in q:
        store_filter = " AND d.hub_code = 'KA06'"
    elif "arsikere" in q or "ka13" in q:
        store_filter = " AND d.hub_code = 'KA13'"

    time_window = ""
    if "today" in q:
        time_window = " AND o.created_at >= datetime('now', '-1 day')"
    elif "week" in q or "7 day" in q:
        time_window = " AND o.created_at >= datetime('now', '-7 days')"

    # Route carefully by question intent
    if any(k in q for k in ("shrinkage", "dump", "dad", "write-off", "damaged", "expired", "loss")):
        sql = (
            "SELECT d.store_name, p.sku_code, p.name AS product_name, s.reason, "
            "SUM(s.qty) AS total_units_lost, ROUND(SUM(s.loss_amount), 2) AS total_loss_inr, "
            "COUNT(*) AS incidents "
            "FROM Shrinkage_Dump_Log s "
            "JOIN Product p ON s.product_id = p.product_id "
            "JOIN Darkstore d ON s.store_id = d.store_id "
            f"WHERE 1=1{store_filter} "
            "GROUP BY d.store_name, p.sku_code, p.name, s.reason "
            "ORDER BY total_loss_inr DESC LIMIT 20"
        )
        return sql, "shrinkage_report"

    if any(k in q for k in ("forecast", "predict", "demand", "mape")):
        sql = (
            "SELECT d.hub_code, p.sku_code, p.name AS product_name, df.forecast_date, "
            "df.predicted_qty, df.actual_qty, ROUND(df.confidence_score * 100, 1) AS confidence_pct, "
            "df.model_version "
            "FROM Demand_Forecast df "
            "JOIN Product p ON df.product_id = p.product_id "
            "JOIN Darkstore d ON df.store_id = d.store_id "
            f"WHERE df.actual_qty IS NOT NULL{store_filter} "
            "ORDER BY df.forecast_date DESC, df.predicted_qty DESC LIMIT 25"
        )
        return sql, "demand_forecast"

    if any(k in q for k in ("low stock", "out of stock", "oos", "reorder", "inventory", "stock")):
        # Customer view omits internal reorder/reserved metadata if needed, Inventory/Product allowed cleanly
        sql = (
            "SELECT d.hub_code, d.store_name, p.sku_code, p.name AS product_name, p.category, "
            "p.bin_location, i.qty_available, i.reorder_point, "
            "CASE WHEN i.qty_available = 0 THEN 'OUT_OF_STOCK' "
            "WHEN i.qty_available <= i.reorder_point THEN 'LOW_STOCK' ELSE 'HEALTHY' END AS stock_status "
            "FROM Inventory i "
            "JOIN Product p ON i.product_id = p.product_id "
            "JOIN Darkstore d ON i.store_id = d.store_id "
            f"WHERE (i.qty_available <= i.reorder_point OR i.qty_available = 0){store_filter} "
            "ORDER BY i.qty_available ASC, p.name ASC LIMIT 25"
        )
        return sql, "inventory_low_stock"

    if any(k in q for k in ("rider", "delivery boy", "delivery girl", "captain", "sinchana", "on-time", "sla breach")):
        sql = (
            "SELECT r.rider_id, r.name AS rider_name, d.store_name, r.vehicle_type, r.status, "
            "r.rating_avg, r.total_deliveries, r.on_time_rate AS on_time_pct, "
            "COUNT(del.delivery_id) AS recent_logged_trips, "
            "ROUND(AVG(del.actual_mins), 2) AS avg_order_to_door_mins "
            "FROM Rider r "
            "JOIN Darkstore d ON r.store_id = d.store_id "
            "LEFT JOIN Delivery del ON r.rider_id = del.rider_id "
            f"WHERE 1=1{store_filter} "
            "GROUP BY r.rider_id, r.name, d.store_name, r.vehicle_type, r.status, r.rating_avg, r.total_deliveries, r.on_time_rate "
            "ORDER BY r.on_time_rate DESC LIMIT 15"
        )
        return sql, "rider_performance"

    if any(k in q for k in ("funnel", "status", "cancelled", "pending", "picking", "staged")):
        sql = (
            "SELECT o.status, COUNT(*) AS order_count, ROUND(SUM(o.total_amount), 2) AS gmv_inr, "
            "ROUND(AVG(o.pick_mins), 2) AS avg_pick_mins, "
            "ROUND(AVG(o.actual_mins), 2) AS avg_total_mins "
            'FROM "Order" o '
            "JOIN Darkstore d ON o.store_id = d.store_id "
            f"WHERE 1=1{store_filter}{time_window} "
            "GROUP BY o.status "
            "ORDER BY order_count DESC LIMIT 10"
        )
        return sql, "order_funnel"

    if any(k in q for k in ("darkstore", "dark store", "hub", "store comparison", "by store")):
        sql = (
            "SELECT d.hub_code, d.store_name, d.city, d.sla_target_mins, d.order_cap_limit, "
            'COUNT(o.order_id) AS total_orders, ROUND(COALESCE(SUM(o.total_amount), 0), 2) AS revenue_inr, '
            "ROUND(AVG(o.actual_mins), 2) AS avg_delivery_mins "
            "FROM Darkstore d "
            'LEFT JOIN "Order" o ON d.store_id = o.store_id AND o.status != \'CANCELLED\' '
            "GROUP BY d.store_id, d.hub_code, d.store_name, d.city, d.sla_target_mins, d.order_cap_limit "
            "ORDER BY revenue_inr DESC LIMIT 10"
        )
        return sql, "sales_by_darkstore"

    if any(k in q for k in ("category", "categories", "margin")):
        margin_expr = ", ROUND(SUM((oi.unit_price - p.cost_price) * oi.quantity), 2) AS gross_margin_inr" if role in (UserRole.ADMIN, UserRole.STORE_STAFF) else ""
        sql = (
            "SELECT p.category, COUNT(DISTINCT o.order_id) AS orders, SUM(oi.quantity) AS units_sold, "
            f"ROUND(SUM(oi.line_total), 2) AS revenue_inr{margin_expr} "
            "FROM Order_Item oi "
            "JOIN Product p ON oi.product_id = p.product_id "
            'JOIN "Order" o ON oi.order_id = o.order_id '
            "JOIN Darkstore d ON o.store_id = d.store_id "
            f"WHERE o.status != 'CANCELLED'{store_filter}{time_window} "
            "GROUP BY p.category "
            "ORDER BY revenue_inr DESC LIMIT 15"
        )
        return sql, "sales_by_category"

    if any(k in q for k in ("rag log", "query log", "rag_query_log", "feedback", "latency")):
        sql = (
            "SELECT log_id, user_role, intent, response_mode, ROUND(grounding_score, 3) AS grounding, "
            "latency_ms, feedback, user_query, created_at "
            "FROM Rag_Query_Log ORDER BY created_at DESC LIMIT 20"
        )
        return sql, "rag_telemetry"

    if any(k in q for k in ("customer", "segment", "vip", "buyer")):
        sql = (
            "SELECT c.customer_id, c.name, c.neighborhood, c.city, c.segment, "
            'COUNT(o.order_id) AS total_orders, ROUND(COALESCE(SUM(o.total_amount), 0), 2) AS lifetime_spend_inr '
            "FROM Customer c "
            'LEFT JOIN "Order" o ON c.customer_id = o.customer_id '
            "GROUP BY c.customer_id, c.name, c.neighborhood, c.city, c.segment "
            "ORDER BY lifetime_spend_inr DESC LIMIT 15"
        )
        return sql, "customer_analytics"

    if any(k in q for k in ("staff", "picker", "thrupthi", "bhaskar", "deepu", "harshitha", "employees")):
        sql = (
            "SELECT s.staff_id, s.name, s.role_code, s.designation, d.store_name, s.zone, s.phone_masked "
            "FROM Staff s JOIN Darkstore d ON s.store_id = d.store_id "
            f"WHERE s.active = 1{store_filter} "
            "ORDER BY s.role_code, s.name LIMIT 20"
        )
        return sql, "staff_directory"

    # Default analytical query: top selling products by units & revenue
    if role == UserRole.CUSTOMER:
        sql = (
            "SELECT p.sku_code, p.name AS product_name, p.category, p.mrp, p.price, "
            "p.unit_weight, i.qty_available "
            "FROM Product p JOIN Inventory i ON p.product_id = i.product_id "
            "JOIN Darkstore d ON i.store_id = d.store_id "
            "WHERE d.hub_code = 'KA44' ORDER BY i.qty_available DESC LIMIT 15"
        )
        return sql, "catalog_prices"

    limit_num = 10
    m = re.search(r"\btop\s+(\d+)\b", q)
    if m:
        limit_num = min(50, max(1, int(m.group(1))))

    sql = (
        "SELECT p.sku_code, p.name AS product_name, p.category, "
        "SUM(oi.quantity) AS units_sold, ROUND(SUM(oi.line_total), 2) AS revenue_inr, "
        "p.price AS unit_price "
        "FROM Order_Item oi "
        "JOIN Product p ON oi.product_id = p.product_id "
        'JOIN "Order" o ON oi.order_id = o.order_id '
        "JOIN Darkstore d ON o.store_id = d.store_id "
        f"WHERE o.status != 'CANCELLED'{store_filter}{time_window} "
        "GROUP BY p.product_id, p.sku_code, p.name, p.category, p.price "
        f"ORDER BY units_sold DESC, revenue_inr DESC LIMIT {limit_num}"
    )
    return sql, "top_selling_products"


def run_nl_to_sql(
    question: str,
    user_role: str | UserRole = UserRole.ADMIN,
    db_path: Path | None = None,
) -> SQLQueryResult:
    """Plan, validate (RBAC + read-only guard), and execute Text-to-SQL for a natural question."""
    planned_sql, topic = plan_sql_from_question(question, user_role=user_role)
    try:
        return execute_safe_sql(planned_sql, user_role=user_role, db_path=db_path, topic=topic)
    except SQLValidationError as exc:
        return SQLQueryResult(
            sql=planned_sql,
            columns=[],
            rows=[],
            row_count=0,
            latency_ms=1,
            topic=topic,
            blocked_reason=str(exc),
        )

