#!/usr/bin/env python3
"""
Local testing and evidence menu for Smart Schedule.

The script wraps the backend test commands, local PostgreSQL evidence setup,
security probes, performance checks, dependency validation, server lifecycle,
and structured evidence generation. It is designed for a normal terminal
window and intentionally refuses to run database or HTTP security tests against
non-local systems.
"""

from __future__ import annotations

import atexit
import csv
import getpass
import http.cookiejar
import json
import os
import platform
import re
import shutil
import signal
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Callable


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
LOCAL_ENV_PATH = BACKEND_DIR / "local-evidence.env"
LOCAL_ENV_EXAMPLE_PATH = BACKEND_DIR / "local-evidence.env.example"
LOG_ROOT = REPO_ROOT / "logs" / "local-test-menu"
EVIDENCE_ROOT = REPO_ROOT / "evidence" / "test-runs"
TEST_DIR = BACKEND_DIR / "src" / "__tests__"
LOCAL_DATABASE_NAME = "smart_schedule_local"
LOCAL_BASE_URL = "http://localhost:3000"
LOCAL_HEALTH_URL = f"{LOCAL_BASE_URL}/health"
MUTATION_PROTECTION_HEADER = "x-smart-schedule-csrf"
DEFAULT_HTTP_TIMEOUT_SECONDS = 5
DEFAULT_PERFORMANCE_REQUESTS = 40
DEFAULT_PERFORMANCE_CONCURRENCY = 8

SECURITY_TESTS = [
    "src/__tests__/auth-routes.test.js",
    "src/__tests__/auth-middleware.test.js",
    "src/__tests__/rate-limit.test.js",
    "src/__tests__/db-config.test.js",
    "src/__tests__/staff-routes.test.js",
    "src/__tests__/assignment-routes.test.js",
]

# Weekly availability was removed from the final project scope. It is therefore
# deliberately absent from the final workflow group.
WORKFLOW_TESTS = [
    "src/__tests__/staff-routes.test.js",
    "src/__tests__/leave-routes.test.js",
    "src/__tests__/shift-routes.test.js",
    "src/__tests__/assignment-routes.test.js",
    "src/__tests__/rota-routes.test.js",
]

SERVER_PROCESS: subprocess.Popen[str] | None = None
SERVER_LOG_HANDLE: Any = None
CURRENT_RUN_ID: str | None = None
CURRENT_RUN_LABEL: str | None = None
CURRENT_RAW_DIR: Path | None = None
CURRENT_EVIDENCE_DIR: Path | None = None
RUN_RESULTS: list[dict[str, Any]] = []
CLEANUP_REGISTERED = False


def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def safe_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "run"


def ensure_directories() -> None:
    LOG_ROOT.mkdir(parents=True, exist_ok=True)
    EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)


def begin_run(label: str) -> str:
    global CURRENT_RUN_ID, CURRENT_RUN_LABEL, CURRENT_RAW_DIR
    global CURRENT_EVIDENCE_DIR, RUN_RESULTS

    ensure_directories()
    run_id = f"{now_stamp()}_{safe_slug(label)}"
    CURRENT_RUN_ID = run_id
    CURRENT_RUN_LABEL = label
    CURRENT_RAW_DIR = LOG_ROOT / run_id
    CURRENT_EVIDENCE_DIR = EVIDENCE_ROOT / run_id
    CURRENT_RAW_DIR.mkdir(parents=True, exist_ok=True)
    CURRENT_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    RUN_RESULTS = []
    return run_id


def ensure_run(label: str = "manual-action") -> None:
    if CURRENT_RUN_ID is None:
        begin_run(label)


def record_result(
    name: str,
    status: str,
    *,
    category: str,
    duration_seconds: float | None = None,
    details: str = "",
    evidence_file: Path | None = None,
    metrics: dict[str, Any] | None = None,
) -> None:
    ensure_run()
    result = {
        "run_id": CURRENT_RUN_ID,
        "recorded_at": datetime.now().isoformat(timespec="seconds"),
        "category": category,
        "name": name,
        "status": status.upper(),
        "duration_seconds": (
            round(duration_seconds, 3) if duration_seconds is not None else None
        ),
        "details": details,
        "evidence_file": str(evidence_file) if evidence_file else "",
        "metrics": metrics or {},
    }
    RUN_RESULTS.append(result)
    write_run_reports()


def overall_status() -> str:
    statuses = [str(item.get("status", "")).upper() for item in RUN_RESULTS]
    if not statuses:
        return "NO RESULTS"
    if "FAIL" in statuses:
        return "FAIL"
    if "WARN" in statuses:
        return "PASS WITH WARNINGS"
    if all(status in {"PASS", "SKIP"} for status in statuses):
        return "PASS"
    return "INCOMPLETE"


def write_run_reports() -> None:
    if CURRENT_EVIDENCE_DIR is None or CURRENT_RUN_ID is None:
        return

    CURRENT_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    report_payload = {
        "project": "Smart Schedule",
        "run_id": CURRENT_RUN_ID,
        "label": CURRENT_RUN_LABEL,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "overall_status": overall_status(),
        "results": RUN_RESULTS,
    }

    json_path = CURRENT_EVIDENCE_DIR / "test-evidence-summary.json"
    json_path.write_text(
        json.dumps(report_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    csv_path = CURRENT_EVIDENCE_DIR / "test-evidence-summary.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as csv_file:
        fieldnames = [
            "run_id",
            "recorded_at",
            "category",
            "name",
            "status",
            "duration_seconds",
            "details",
            "evidence_file",
            "metrics",
        ]
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for item in RUN_RESULTS:
            row = dict(item)
            row["metrics"] = json.dumps(row.get("metrics", {}), ensure_ascii=False)
            writer.writerow(row)

    text_path = CURRENT_EVIDENCE_DIR / "test-evidence-summary.txt"
    lines = [
        "Smart Schedule automated test evidence",
        "=" * 40,
        f"Run ID: {CURRENT_RUN_ID}",
        f"Run label: {CURRENT_RUN_LABEL}",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        f"Overall status: {overall_status()}",
        "",
    ]

    for item in RUN_RESULTS:
        duration = item.get("duration_seconds")
        duration_text = f" ({duration:.3f}s)" if isinstance(duration, float) else ""
        lines.append(
            f"[{item['status']}] {item['category']} - {item['name']}{duration_text}"
        )
        if item.get("details"):
            lines.append(f"  {item['details']}")
        metrics = item.get("metrics") or {}
        for key, value in metrics.items():
            lines.append(f"  {key}: {value}")

    text_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    latest_dir = EVIDENCE_ROOT / "latest"
    latest_dir.mkdir(parents=True, exist_ok=True)
    for old_file in latest_dir.glob("*"):
        if old_file.is_file():
            old_file.unlink()
    for source in (json_path, csv_path, text_path):
        shutil.copy2(source, latest_dir / source.name)


def finish_run() -> None:
    write_run_reports()
    if CURRENT_EVIDENCE_DIR is not None:
        print()
        print(f"Structured evidence: {CURRENT_EVIDENCE_DIR}")
        print(f"Overall evidence status: {overall_status()}")


def command_name(name: str) -> str:
    if os.name == "nt":
        cmd_name = f"{name}.cmd"
        if shutil.which(cmd_name):
            return cmd_name
    return name


def print_header() -> None:
    print()
    print("Smart Schedule local testing and evidence menu")
    print("=" * 48)
    print(f"Repo: {REPO_ROOT}")
    print(f"Backend: {BACKEND_DIR}")
    print(f"Raw logs: {LOG_ROOT}")
    print(f"Curated evidence: {EVIDENCE_ROOT}")
    print()
    print("Database-backed tests are blocked unless DATABASE_URL is local.")
    print("HTTP security and performance tests are blocked unless the target is local.")
    print()


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def write_local_env(postgres_password: str) -> None:
    encoded_password = urllib.parse.quote(postgres_password, safe="")
    database_url = (
        f"postgresql://postgres:{encoded_password}@localhost:5432/"
        f"{LOCAL_DATABASE_NAME}"
    )

    content = "\n".join(
        [
            f"DATABASE_URL={database_url}",
            "SESSION_SECRET=local-evidence-session-secret-change-me",
            "SESSION_IDLE_TIMEOUT_MINUTES=120",
            "NODE_ENV=development",
            "PORT=3000",
            "",
        ]
    )
    LOCAL_ENV_PATH.write_text(content, encoding="utf-8")


def local_database_url() -> str:
    return read_env_file(LOCAL_ENV_PATH).get("DATABASE_URL", "")


def is_local_database_url(database_url: str) -> bool:
    if not database_url:
        return False
    try:
        parsed = urllib.parse.urlparse(database_url)
        return parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    except ValueError:
        return any(host in database_url for host in ("localhost", "127.0.0.1", "::1"))


def is_local_http_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in {"http", "https"} and parsed.hostname in {
            "localhost",
            "127.0.0.1",
            "::1",
        }
    except ValueError:
        return False


def require_local_http_url(url: str) -> None:
    if not is_local_http_url(url):
        raise RuntimeError(f"Blocked non-local HTTP test target: {url}")


def require_local_env() -> dict[str, str] | None:
    if not LOCAL_ENV_PATH.exists():
        print()
        print("backend/local-evidence.env is missing.")
        print("Run local database setup first, or copy the example file manually.")
        return None

    env_values = read_env_file(LOCAL_ENV_PATH)
    database_url = env_values.get("DATABASE_URL", "")
    if not is_local_database_url(database_url):
        print()
        print("Blocked: DATABASE_URL in backend/local-evidence.env is not local.")
        print("Tests will not run against Neon or another hosted database.")
        return None

    return env_values


def command_env(use_local_env: bool = False, node_env: str | None = None) -> dict[str, str]:
    env = os.environ.copy()
    if use_local_env:
        env_values = require_local_env()
        if env_values is None:
            raise RuntimeError("local evidence environment is not ready")
        env.update(env_values)
    if node_env:
        env["NODE_ENV"] = node_env
    return env


def redact_text(text: str) -> str:
    redacted = text
    redacted = re.sub(
        r"(postgres(?:ql)?://[^:\s]+:)[^@\s]+(@)",
        r"\1[redacted]\2",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        r"(?im)^(\s*(?:SESSION_SECRET|DATABASE_URL)\s*[=:]\s*).+$",
        r"\1[redacted]",
        redacted,
    )
    redacted = re.sub(
        r"(?im)^(\s*(?:Manager password|Demo staff password)\s*:\s*).+$",
        r"\1[redacted]",
        redacted,
    )
    return redacted


def redact_line(line: str) -> str:
    redacted = redact_text(line)
    return redacted if redacted.endswith("\n") else redacted + "\n"


def run_command(
    title: str,
    command: list[str],
    cwd: Path,
    *,
    use_local_env: bool = False,
    node_env: str | None = None,
    category: str = "Command",
    prompt_screenshot: bool = True,
) -> int:
    ensure_run(title)
    assert CURRENT_RAW_DIR is not None
    slug = safe_slug(title)
    log_path = CURRENT_RAW_DIR / f"{now_stamp()}_{slug}.txt"

    print()
    print(f"Running: {title}")
    print(f"Command: {' '.join(command)}")
    print(f"Raw output log: {log_path}")
    print("-" * 72)

    try:
        env = command_env(use_local_env=use_local_env, node_env=node_env)
    except RuntimeError as error:
        print(error)
        record_result(title, "FAIL", category=category, details=str(error))
        return 1

    started = time.perf_counter()
    try:
        with log_path.open("w", encoding="utf-8") as log_file:
            log_file.write("Smart Schedule test menu\n")
            log_file.write(f"Run ID: {CURRENT_RUN_ID}\n")
            log_file.write(f"Started: {datetime.now().isoformat(timespec='seconds')}\n")
            log_file.write(f"Title: {title}\n")
            log_file.write(f"CWD: {cwd}\n")
            log_file.write(f"Command: {' '.join(command)}\n")
            log_file.write("-" * 72 + "\n")

            process = subprocess.Popen(
                command,
                cwd=str(cwd),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            assert process.stdout is not None
            for line in process.stdout:
                cleaned = redact_line(line)
                print(cleaned, end="")
                log_file.write(cleaned)

            return_code = process.wait()
            duration = time.perf_counter() - started
            log_file.write("-" * 72 + "\n")
            log_file.write(f"Exit code: {return_code}\n")
            log_file.write(f"Duration seconds: {duration:.3f}\n")
            log_file.write(f"Finished: {datetime.now().isoformat(timespec='seconds')}\n")
    except FileNotFoundError as error:
        duration = time.perf_counter() - started
        print(f"Command could not start: {error}")
        record_result(
            title,
            "FAIL",
            category=category,
            duration_seconds=duration,
            details=str(error),
        )
        return 1

    print("-" * 72)
    print(f"Exit code: {return_code}")
    status = "PASS" if return_code == 0 else "FAIL"
    record_result(
        title,
        status,
        category=category,
        duration_seconds=duration,
        details=f"Process exit code {return_code}.",
        evidence_file=log_path,
    )

    if prompt_screenshot:
        prompt_for_screenshot(f"{slug}-result")
    return return_code


def run_captured_command(
    title: str,
    command: list[str],
    cwd: Path,
    *,
    category: str,
) -> tuple[int, str]:
    started = time.perf_counter()
    try:
        result = subprocess.run(
            command,
            cwd=str(cwd),
            text=True,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError as error:
        record_result(
            title,
            "FAIL",
            category=category,
            duration_seconds=time.perf_counter() - started,
            details=str(error),
        )
        return 1, str(error)

    output = redact_text((result.stdout or "") + (result.stderr or "")).strip()
    record_result(
        title,
        "PASS" if result.returncode == 0 else "FAIL",
        category=category,
        duration_seconds=time.perf_counter() - started,
        details=output[-1000:] if output else f"Exit code {result.returncode}.",
    )
    return result.returncode, output


def check_tools() -> int:
    print()
    print("Tool and project check")
    print("-" * 72)
    all_ok = True

    tools = [
        ("Python", [sys.executable, "--version"]),
        ("Node", [command_name("node"), "--version"]),
        ("npm", [command_name("npm"), "--version"]),
        ("Git", [command_name("git"), "--version"]),
    ]

    for label, command in tools:
        try:
            result = subprocess.run(
                command,
                cwd=str(REPO_ROOT),
                text=True,
                capture_output=True,
                check=False,
            )
            output = (result.stdout or result.stderr).strip()
            status = "ok" if result.returncode == 0 else "failed"
            print(f"{label}: {status} {output}")
            if result.returncode != 0:
                all_ok = False
        except FileNotFoundError:
            print(f"{label}: missing")
            all_ok = False

    print()
    if LOCAL_ENV_PATH.exists():
        database_url = local_database_url()
        local_status = "local" if is_local_database_url(database_url) else "not local"
        print(f"backend/local-evidence.env: found ({local_status})")
        if local_status != "local":
            all_ok = False
    elif LOCAL_ENV_EXAMPLE_PATH.exists():
        print("backend/local-evidence.env: missing, example file exists")
    else:
        print("backend/local-evidence.env: missing, example file also missing")
        all_ok = False

    test_files = sorted(TEST_DIR.glob("*.test.js"))
    print(f"Backend test files found: {len(test_files)}")
    for test_file in test_files:
        print(f"- {test_file.relative_to(BACKEND_DIR).as_posix()}")

    stale_availability = [
        TEST_DIR / "availability-routes.test.js",
        BACKEND_DIR / "src" / "routes" / "availability.js",
        BACKEND_DIR / "src" / "services" / "availability-service.js",
    ]
    existing_stale = [path for path in stale_availability if path.exists()]
    if existing_stale:
        print()
        print("Scope warning: weekly availability was removed from the final scope,")
        print("but these implementation files still exist:")
        for path in existing_stale:
            print(f"- {path.relative_to(REPO_ROOT)}")
        record_result(
            "Removed-feature scope consistency",
            "WARN",
            category="Project consistency",
            details=f"{len(existing_stale)} availability implementation file(s) remain.",
        )

    record_result(
        "Tool and project check",
        "PASS" if all_ok else "FAIL",
        category="Environment",
        details=f"Found {len(test_files)} Jest test files.",
    )
    return 0 if all_ok else 1


def run_dependency_tree_check(*, prompt_screenshot: bool = True) -> int:
    return run_command(
        "npm dependency tree validation",
        [command_name("npm"), "ls", "--all"],
        BACKEND_DIR,
        category="Dependency validation",
        prompt_screenshot=prompt_screenshot,
    )


def backend_packages_ready() -> bool:
    node_modules = BACKEND_DIR / "node_modules"
    if not node_modules.exists():
        return False
    try:
        result = subprocess.run(
            [command_name("npm"), "ls", "--all"],
            cwd=str(BACKEND_DIR),
            text=True,
            capture_output=True,
            check=False,
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def check_install_needs() -> int:
    print()
    print("Install check")
    print("-" * 72)

    missing_tools = []
    for tool in ["node", "npm"]:
        if shutil.which(command_name(tool)) is None and shutil.which(tool) is None:
            missing_tools.append(tool)

    if missing_tools:
        message = f"Missing required tool(s): {', '.join(missing_tools)}"
        print(message)
        print("Install Node.js from the official installer, then reopen the terminal.")
        record_result("Install readiness", "FAIL", category="Environment", details=message)
        return 1

    if backend_packages_ready():
        print("The npm dependency tree is complete and valid.")
        record_result(
            "Install readiness",
            "PASS",
            category="Environment",
            details="npm ls --all completed successfully.",
        )
        return 0

    package_lock = BACKEND_DIR / "package-lock.json"
    install_command = [command_name("npm"), "ci"] if package_lock.exists() else [
        command_name("npm"),
        "install",
    ]
    install_label = "npm ci" if package_lock.exists() else "npm install"

    print("Backend npm packages are missing, incomplete, or invalid.")
    answer = input(f"Run {install_label} in backend now? [y/N]: ").strip().lower()
    if answer != "y":
        print("No install was run.")
        record_result(
            "Install readiness",
            "FAIL",
            category="Environment",
            details="Dependency installation was required but declined.",
        )
        return 1

    return run_command(
        f"Install backend npm packages with {install_label}",
        install_command,
        BACKEND_DIR,
        category="Dependency installation",
    )


def setup_local_database() -> int:
    print()
    print("Local evidence setup")
    print("-" * 72)
    print("This writes backend/local-evidence.env and creates smart_schedule_local.")
    print("It uses the local PostgreSQL postgres user only.")
    print("The password is not printed or written to test logs.")
    print()

    if not (BACKEND_DIR / "node_modules" / "pg").exists():
        message = "backend/node_modules/pg is missing. Run the install option first."
        print(message)
        record_result("Local database setup", "FAIL", category="Database", details=message)
        return 1

    password = getpass.getpass("Local PostgreSQL postgres password: ")
    write_local_env(password)
    print("backend/local-evidence.env written.")

    node_code = r"""
const { Client } = require('pg');

function quoteIdentifier(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

(async () => {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.PGSETUP_PASSWORD || '',
    database: 'postgres'
  });

  await client.connect();
  const dbName = process.env.SMART_SCHEDULE_LOCAL_DB || 'smart_schedule_local';
  const exists = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName]
  );

  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
    console.log(`Created database ${dbName}.`);
  } else {
    console.log(`Database ${dbName} already exists.`);
  }

  await client.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
"""

    env = os.environ.copy()
    env["PGSETUP_PASSWORD"] = password
    env["SMART_SCHEDULE_LOCAL_DB"] = LOCAL_DATABASE_NAME

    ensure_run("setup-local-database")
    assert CURRENT_RAW_DIR is not None
    log_path = CURRENT_RAW_DIR / f"{now_stamp()}_setup-local-database.txt"
    print(f"Setup log: {log_path}")
    print("-" * 72)
    started = time.perf_counter()

    with log_path.open("w", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            [command_name("node"), "-e", node_code],
            cwd=str(BACKEND_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        assert process.stdout is not None
        for line in process.stdout:
            cleaned = redact_line(line)
            print(cleaned, end="")
            log_file.write(cleaned)
        return_code = process.wait()
        log_file.write(f"Exit code: {return_code}\n")

    duration = time.perf_counter() - started
    print("-" * 72)
    print(f"Exit code: {return_code}")
    if return_code != 0:
        print("Check that PostgreSQL is running on localhost:5432.")

    record_result(
        "Local database setup",
        "PASS" if return_code == 0 else "FAIL",
        category="Database",
        duration_seconds=duration,
        details=f"Process exit code {return_code}.",
        evidence_file=log_path,
    )
    prompt_for_screenshot("setup-local-database")
    return return_code


def local_evidence_check(*, prompt_screenshot: bool = True) -> int:
    return run_command(
        "Local evidence database check",
        [command_name("npm"), "run", "local:evidence:check"],
        BACKEND_DIR,
        use_local_env=True,
        node_env="development",
        category="Database",
        prompt_screenshot=prompt_screenshot,
    )


def local_evidence_all(*, prompt_screenshot: bool = True) -> int:
    return run_command(
        "Migrate and seed local evidence database",
        [command_name("npm"), "run", "local:evidence:all"],
        BACKEND_DIR,
        use_local_env=True,
        node_env="development",
        category="Database",
        prompt_screenshot=prompt_screenshot,
    )


def run_full_backend_tests(*, prompt_screenshot: bool = True) -> int:
    return run_command(
        "Full backend Jest suite",
        [command_name("npm"), "test"],
        BACKEND_DIR,
        use_local_env=True,
        node_env="test",
        category="Automated testing",
        prompt_screenshot=prompt_screenshot,
    )


def existing_test_paths(test_paths: list[str]) -> tuple[list[str], list[str]]:
    existing = [path for path in test_paths if (BACKEND_DIR / path).exists()]
    missing = [path for path in test_paths if not (BACKEND_DIR / path).exists()]
    return existing, missing


def run_selected_tests(
    title: str,
    test_paths: list[str],
    *,
    prompt_screenshot: bool = True,
) -> int:
    existing, missing = existing_test_paths(test_paths)
    if missing:
        print()
        print(f"Skipped missing test files for {title}:")
        for path in missing:
            print(f"- {path}")

    if not existing:
        record_result(
            title,
            "FAIL",
            category="Automated testing",
            details="No configured test files exist.",
        )
        return 1

    return run_command(
        title,
        [command_name("npm"), "test", "--", "--runTestsByPath", *existing],
        BACKEND_DIR,
        use_local_env=True,
        node_env="test",
        category="Automated testing",
        prompt_screenshot=prompt_screenshot,
    )


def run_security_tests(*, prompt_screenshot: bool = True) -> int:
    return run_selected_tests(
        "Security and access-control Jest tests",
        SECURITY_TESTS,
        prompt_screenshot=prompt_screenshot,
    )


def run_workflow_tests(*, prompt_screenshot: bool = True) -> int:
    return run_selected_tests(
        "Core workflow route Jest tests",
        WORKFLOW_TESTS,
        prompt_screenshot=prompt_screenshot,
    )


def run_dependency_audit(*, prompt_screenshot: bool = True) -> int:
    return run_command(
        "npm dependency security audit",
        [command_name("npm"), "audit", "--audit-level=moderate"],
        BACKEND_DIR,
        category="Security testing",
        prompt_screenshot=prompt_screenshot,
    )


def request_once(
    url: str,
    *,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout_seconds: float = DEFAULT_HTTP_TIMEOUT_SECONDS,
    opener: urllib.request.OpenerDirector | None = None,
) -> tuple[int, dict[str, str], str, float]:
    require_local_http_url(url)
    request_headers = {
        "User-Agent": "SmartScheduleLocalEvidence/1.0",
        **(headers or {}),
    }
    request = urllib.request.Request(
        url,
        data=data,
        headers=request_headers,
        method=method,
    )
    request_opener = opener or urllib.request.build_opener()
    started = time.perf_counter()
    try:
        with request_opener.open(request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="replace")
            elapsed = time.perf_counter() - started
            response_headers = {key.lower(): value for key, value in response.headers.items()}
            return response.status, response_headers, body, elapsed
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        elapsed = time.perf_counter() - started
        response_headers = {key.lower(): value for key, value in error.headers.items()}
        return error.code, response_headers, body, elapsed


def json_request(
    url: str,
    *,
    method: str,
    payload: dict[str, Any],
    headers: dict[str, str] | None = None,
    opener: urllib.request.OpenerDirector | None = None,
) -> tuple[int, dict[str, str], str, float]:
    encoded = json.dumps(payload).encode("utf-8")
    return request_once(
        url,
        method=method,
        data=encoded,
        headers={"Content-Type": "application/json", **(headers or {})},
        opener=opener,
    )


def check_health(timeout_seconds: int = 3, *, record: bool = True) -> bool:
    started = time.perf_counter()
    try:
        status, _headers, body, elapsed = request_once(
            LOCAL_HEALTH_URL,
            timeout_seconds=timeout_seconds,
        )
        print(f"Health HTTP {status}: {body}")
        passed = status == 200 and '"status":"ok"' in body.replace(" ", "")
        if record:
            record_result(
                "Local health endpoint",
                "PASS" if passed else "FAIL",
                category="System testing",
                duration_seconds=elapsed,
                details=f"HTTP {status}; response={body[:300]}",
            )
        return passed
    except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
        print(f"Health check failed: {error}")
        if record:
            record_result(
                "Local health endpoint",
                "FAIL",
                category="System testing",
                duration_seconds=time.perf_counter() - started,
                details=str(error),
            )
        return False


def start_local_server(*, record: bool = True) -> int:
    global SERVER_PROCESS, SERVER_LOG_HANDLE

    print()
    if check_health(timeout_seconds=1, record=False):
        print("Local server is already responding.")
        if record:
            record_result(
                "Start local server",
                "PASS",
                category="System testing",
                details="A local server was already running.",
            )
        return 0

    try:
        env = command_env(use_local_env=True, node_env="development")
    except RuntimeError as error:
        print(error)
        if record:
            record_result(
                "Start local server",
                "FAIL",
                category="System testing",
                details=str(error),
            )
        return 1

    ensure_run("local-server")
    assert CURRENT_RAW_DIR is not None
    log_path = CURRENT_RAW_DIR / f"{now_stamp()}_local-server.txt"
    SERVER_LOG_HANDLE = log_path.open("w", encoding="utf-8")

    print(f"Starting local evidence server. Server log: {log_path}")
    SERVER_PROCESS = subprocess.Popen(
        [command_name("npm"), "run", "local:evidence:start"],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=SERVER_LOG_HANDLE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    started = time.perf_counter()
    for _ in range(30):
        time.sleep(0.5)
        if check_health(timeout_seconds=1, record=False):
            duration = time.perf_counter() - started
            print("Server is ready at http://localhost:3000")
            if record:
                record_result(
                    "Start local server",
                    "PASS",
                    category="System testing",
                    duration_seconds=duration,
                    details="Local server started and health endpoint responded.",
                    evidence_file=log_path,
                )
            return 0
        if SERVER_PROCESS.poll() is not None:
            break

    duration = time.perf_counter() - started
    print("Server did not answer the health check. Review the server log.")
    if record:
        record_result(
            "Start local server",
            "FAIL",
            category="System testing",
            duration_seconds=duration,
            details="Local server did not become healthy.",
            evidence_file=log_path,
        )
    return 1


def stop_local_server(*, quiet_if_none: bool = False, record: bool = False) -> int:
    global SERVER_PROCESS, SERVER_LOG_HANDLE

    if SERVER_PROCESS is None:
        if not quiet_if_none:
            print("This script has no tracked server process to stop.")
            print("A server started in another terminal must be stopped there.")
        return 0

    print("Stopping local server started by this menu.")
    started = time.perf_counter()
    SERVER_PROCESS.terminate()
    try:
        SERVER_PROCESS.wait(timeout=10)
    except subprocess.TimeoutExpired:
        SERVER_PROCESS.kill()
        SERVER_PROCESS.wait(timeout=5)

    SERVER_PROCESS = None
    if SERVER_LOG_HANDLE is not None:
        SERVER_LOG_HANDLE.close()
        SERVER_LOG_HANDLE = None
    print("Server stopped.")

    if record:
        record_result(
            "Stop local server",
            "PASS",
            category="System testing",
            duration_seconds=time.perf_counter() - started,
            details="Tracked local server process stopped.",
        )
    return 0


def register_cleanup_handlers() -> None:
    global CLEANUP_REGISTERED
    if CLEANUP_REGISTERED:
        return

    atexit.register(lambda: stop_local_server(quiet_if_none=True, record=False))

    def handle_signal(signum: int, _frame: Any) -> None:
        print()
        print(f"Received signal {signum}; stopping tracked local server.")
        stop_local_server(quiet_if_none=True, record=False)
        raise SystemExit(128 + signum)

    for signal_name in ("SIGINT", "SIGTERM"):
        signal_value = getattr(signal, signal_name, None)
        if signal_value is not None:
            signal.signal(signal_value, handle_signal)

    CLEANUP_REGISTERED = True


def parse_local_evidence_credentials() -> tuple[str, str] | None:
    seed_script = BACKEND_DIR / "src" / "scripts" / "prepare-local-evidence.js"
    if not seed_script.exists():
        return None

    source = seed_script.read_text(encoding="utf-8", errors="replace")
    domain_match = re.search(r"const\s+evidenceDomain\s*=\s*['\"]([^'\"]+)['\"]", source)
    email_literal_match = re.search(
        r"const\s+evidenceManagerEmail\s*=\s*['\"]([^'\"]+)['\"]",
        source,
    )
    email_template_match = re.search(
        r"const\s+evidenceManagerEmail\s*=\s*`([^`]+)`",
        source,
    )
    password_match = re.search(
        r"const\s+evidenceManagerPassword\s*=\s*['\"]([^'\"]+)['\"]",
        source,
    )

    email = email_literal_match.group(1) if email_literal_match else ""
    if not email and email_template_match and domain_match:
        email = email_template_match.group(1).replace("${evidenceDomain}", domain_match.group(1))
    password = password_match.group(1) if password_match else ""
    return (email, password) if email and password else None


def security_probe(
    name: str,
    passed: bool,
    *,
    details: str,
    duration_seconds: float | None = None,
    metrics: dict[str, Any] | None = None,
) -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}: {details}")
    record_result(
        name,
        status,
        category="Direct security probes",
        duration_seconds=duration_seconds,
        details=details,
        metrics=metrics,
    )
    return passed


def run_direct_security_probes(*, prompt_screenshot: bool = True) -> int:
    print()
    print("Direct local HTTP security probes")
    print("-" * 72)
    require_local_http_url(LOCAL_BASE_URL)

    if not check_health(timeout_seconds=2, record=False):
        message = "Local server is not healthy. Start it before running probes."
        print(message)
        record_result(
            "Direct security probes",
            "FAIL",
            category="Direct security probes",
            details=message,
        )
        return 1

    passed_checks: list[bool] = []

    status, headers, body, elapsed = request_once(LOCAL_HEALTH_URL)
    required_headers = {
        "content-security-policy": headers.get("content-security-policy"),
        "x-content-type-options": headers.get("x-content-type-options"),
        "x-frame-options": headers.get("x-frame-options"),
    }
    missing_headers = [name for name, value in required_headers.items() if not value]
    passed_checks.append(
        security_probe(
            "Helmet security headers",
            status == 200 and not missing_headers,
            details=(
                "Required headers present."
                if not missing_headers
                else f"Missing headers: {', '.join(missing_headers)}"
            ),
            duration_seconds=elapsed,
            metrics=required_headers,
        )
    )

    passed_checks.append(
        security_probe(
            "Technology disclosure header",
            "x-powered-by" not in headers,
            details=(
                "X-Powered-By is absent."
                if "x-powered-by" not in headers
                else f"Unexpected value: {headers.get('x-powered-by')}"
            ),
        )
    )

    status, _headers, body, elapsed = request_once(f"{LOCAL_BASE_URL}/api/v1/auth/me")
    passed_checks.append(
        security_probe(
            "Unauthenticated session endpoint",
            status == 401,
            details=f"Expected HTTP 401; received HTTP {status}. Body: {body[:200]}",
            duration_seconds=elapsed,
        )
    )

    status, _headers, body, elapsed = request_once(f"{LOCAL_BASE_URL}/api/v1/staff")
    passed_checks.append(
        security_probe(
            "Unauthorised manager endpoint",
            status == 401,
            details=f"Expected HTTP 401; received HTTP {status}. Body: {body[:200]}",
            duration_seconds=elapsed,
        )
    )

    status, _headers, body, elapsed = json_request(
        f"{LOCAL_BASE_URL}/api/v1/auth/logout",
        method="POST",
        payload={},
    )
    passed_checks.append(
        security_probe(
            "Missing mutation-protection header",
            status == 403,
            details=f"Expected HTTP 403; received HTTP {status}. Body: {body[:200]}",
            duration_seconds=elapsed,
        )
    )

    malformed = b'{"email":"broken@example.test","password":'
    status, _headers, body, elapsed = request_once(
        f"{LOCAL_BASE_URL}/api/v1/auth/login",
        method="POST",
        data=malformed,
        headers={"Content-Type": "application/json"},
    )
    passed_checks.append(
        security_probe(
            "Malformed JSON handling",
            status == 400,
            details=f"Expected HTTP 400; received HTTP {status}. Body: {body[:200]}",
            duration_seconds=elapsed,
        )
    )

    xss_payload = "<script>alert('smart-schedule-test')</script>"
    status, _headers, body, elapsed = json_request(
        f"{LOCAL_BASE_URL}/api/v1/auth/login",
        method="POST",
        payload={"email": xss_payload, "password": "InvalidPassword123!"},
    )
    xss_passed = status in {400, 401, 429} and xss_payload not in body
    passed_checks.append(
        security_probe(
            "Reflected XSS payload handling",
            xss_passed,
            details=f"HTTP {status}; payload was {'not ' if xss_payload not in body else ''}reflected.",
            duration_seconds=elapsed,
        )
    )

    sql_payload = "' OR 1=1 --"
    status, _headers, body, elapsed = json_request(
        f"{LOCAL_BASE_URL}/api/v1/auth/login",
        method="POST",
        payload={"email": sql_payload, "password": sql_payload},
    )
    sql_error_terms = ("syntax error", "postgres", "relation ", "sqlstate", "query failed")
    leaked_sql_error = any(term in body.lower() for term in sql_error_terms)
    sql_passed = status in {400, 401, 429} and not leaked_sql_error
    passed_checks.append(
        security_probe(
            "SQL-injection payload handling",
            sql_passed,
            details=f"HTTP {status}; database error disclosure={leaked_sql_error}.",
            duration_seconds=elapsed,
        )
    )

    oversized_email = "a" * (34 * 1024) + "@example.test"
    status, _headers, body, elapsed = json_request(
        f"{LOCAL_BASE_URL}/api/v1/auth/login",
        method="POST",
        payload={"email": oversized_email, "password": "InvalidPassword123!"},
    )
    passed_checks.append(
        security_probe(
            "Oversized JSON body rejection",
            status == 413,
            details=f"Expected HTTP 413; received HTTP {status}. Body: {body[:200]}",
            duration_seconds=elapsed,
        )
    )

    credentials = parse_local_evidence_credentials()
    if credentials:
        email, password = credentials
        cookie_jar = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
        status, login_headers, body, elapsed = json_request(
            f"{LOCAL_BASE_URL}/api/v1/auth/login",
            method="POST",
            payload={"email": email, "password": password, "rememberMe": False},
            opener=opener,
        )
        set_cookie = login_headers.get("set-cookie", "")
        cookie_passed = (
            status == 200
            and "httponly" in set_cookie.lower()
            and "samesite=lax" in set_cookie.lower()
            and login_headers.get("cache-control", "").lower() == "no-store"
        )
        passed_checks.append(
            security_probe(
                "Authenticated session-cookie controls",
                cookie_passed,
                details=(
                    f"HTTP {status}; HttpOnly={'httponly' in set_cookie.lower()}; "
                    f"SameSite=Lax={'samesite=lax' in set_cookie.lower()}; "
                    f"Cache-Control={login_headers.get('cache-control', '')}."
                ),
                duration_seconds=elapsed,
            )
        )
        if status == 200:
            json_request(
                f"{LOCAL_BASE_URL}/api/v1/auth/logout",
                method="POST",
                payload={},
                headers={MUTATION_PROTECTION_HEADER: "local-evidence"},
                opener=opener,
            )
    else:
        print("[SKIP] Authenticated cookie probe: local evidence credentials not found.")
        record_result(
            "Authenticated session-cookie controls",
            "SKIP",
            category="Direct security probes",
            details="Could not parse local evidence credentials from the seed script.",
        )

    # Run this last because it intentionally exhausts the local login limiter.
    rate_limit_reached = False
    rate_statuses: list[int] = []
    rate_started = time.perf_counter()
    unique_email = f"rate-limit-{now_stamp()}@evidence.invalid"
    for _ in range(7):
        status, _headers, _body, _elapsed = json_request(
            f"{LOCAL_BASE_URL}/api/v1/auth/login",
            method="POST",
            payload={"email": unique_email, "password": "InvalidPassword123!"},
        )
        rate_statuses.append(status)
        if status == 429:
            rate_limit_reached = True
            break
    passed_checks.append(
        security_probe(
            "Login rate limiting",
            rate_limit_reached,
            details=f"Observed HTTP statuses: {rate_statuses}",
            duration_seconds=time.perf_counter() - rate_started,
            metrics={"attempts": len(rate_statuses), "statuses": rate_statuses},
        )
    )

    passed_count = sum(1 for passed in passed_checks if passed)
    total_count = len(passed_checks)
    final_passed = passed_count == total_count
    print("-" * 72)
    print(f"Direct security probes passed: {passed_count}/{total_count}")

    if prompt_screenshot:
        prompt_for_screenshot("direct-security-probes")
    return 0 if final_passed else 1


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(round((len(ordered) - 1) * fraction))))
    return ordered[index]


def run_performance_test(
    *,
    url: str = f"{LOCAL_BASE_URL}/",
    total_requests: int = DEFAULT_PERFORMANCE_REQUESTS,
    concurrency: int = DEFAULT_PERFORMANCE_CONCURRENCY,
    prompt_screenshot: bool = True,
) -> int:
    require_local_http_url(url)
    if total_requests < 1 or concurrency < 1:
        raise ValueError("total_requests and concurrency must both be positive")

    print()
    print("Local HTTP performance test")
    print("-" * 72)
    print(f"Target: {url}")
    print(f"Requests: {total_requests}")
    print(f"Concurrency: {concurrency}")

    if not check_health(timeout_seconds=2, record=False):
        message = "Local server is not healthy. Start it before performance testing."
        print(message)
        record_result(
            "Local HTTP performance test",
            "FAIL",
            category="Performance testing",
            details=message,
        )
        return 1

    def worker() -> tuple[int, float, str]:
        try:
            status, _headers, body, elapsed = request_once(url, timeout_seconds=10)
            return status, elapsed, body[:120]
        except Exception as error:  # Each failed request is evidence, not a crash.
            return 0, 10.0, str(error)

    started = time.perf_counter()
    responses: list[tuple[int, float, str]] = []
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker) for _ in range(total_requests)]
        for future in as_completed(futures):
            responses.append(future.result())
    wall_time = time.perf_counter() - started

    durations_ms = [elapsed * 1000 for status, elapsed, _body in responses if status > 0]
    successful = [status for status, _elapsed, _body in responses if 200 <= status < 400]
    failed = [item for item in responses if not (200 <= item[0] < 400)]
    success_rate = (len(successful) / total_requests) * 100
    requests_per_second = total_requests / wall_time if wall_time > 0 else 0.0

    metrics = {
        "target": url,
        "total_requests": total_requests,
        "concurrency": concurrency,
        "successful_requests": len(successful),
        "failed_requests": len(failed),
        "success_rate_percent": round(success_rate, 2),
        "wall_time_seconds": round(wall_time, 3),
        "requests_per_second": round(requests_per_second, 2),
        "average_response_ms": round(statistics.mean(durations_ms), 2) if durations_ms else None,
        "median_response_ms": round(statistics.median(durations_ms), 2) if durations_ms else None,
        "p95_response_ms": round(percentile(durations_ms, 0.95), 2) if durations_ms else None,
        "maximum_response_ms": round(max(durations_ms), 2) if durations_ms else None,
        "status_codes": {
            str(code): sum(1 for status, _elapsed, _body in responses if status == code)
            for code in sorted({status for status, _elapsed, _body in responses})
        },
    }

    assert CURRENT_EVIDENCE_DIR is not None
    performance_path = CURRENT_EVIDENCE_DIR / "performance-results.json"
    performance_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    passed = success_rate == 100 and (metrics["p95_response_ms"] or 0) < 1000
    details = (
        f"Success rate {success_rate:.2f}%; p95 {metrics['p95_response_ms']} ms; "
        f"throughput {requests_per_second:.2f} requests/second."
    )
    print(details)
    if failed:
        print(f"Failed response samples: {failed[:3]}")

    record_result(
        "Local HTTP performance test",
        "PASS" if passed else "FAIL",
        category="Performance testing",
        duration_seconds=wall_time,
        details=details,
        evidence_file=performance_path,
        metrics=metrics,
    )

    if prompt_screenshot:
        prompt_for_screenshot("performance-test")
    return 0 if passed else 1


def run_complete_evidence_suite() -> int:
    print()
    print("Complete Smart Schedule evidence suite")
    print("=" * 72)
    print("The suite continues after individual failures so that one run produces")
    print("a complete record of passes, failures, and remediation targets.")

    steps: list[tuple[str, Callable[[], int]]] = [
        (
            "Dependency tree",
            lambda: run_dependency_tree_check(prompt_screenshot=False),
        ),
        (
            "Local database check",
            lambda: local_evidence_check(prompt_screenshot=False),
        ),
        (
            "Migrations and seed",
            lambda: local_evidence_all(prompt_screenshot=False),
        ),
        (
            "Full Jest suite",
            lambda: run_full_backend_tests(prompt_screenshot=False),
        ),
        (
            "Security Jest group",
            lambda: run_security_tests(prompt_screenshot=False),
        ),
        (
            "Workflow Jest group",
            lambda: run_workflow_tests(prompt_screenshot=False),
        ),
        (
            "Dependency audit",
            lambda: run_dependency_audit(prompt_screenshot=False),
        ),
    ]

    return_codes: list[int] = []
    for step_name, step in steps:
        print()
        print(f"Evidence step: {step_name}")
        try:
            return_codes.append(step())
        except Exception as error:
            print(f"Step failed unexpectedly: {error}")
            record_result(
                step_name,
                "FAIL",
                category="Evidence suite",
                details=f"Unhandled error: {error}",
            )
            return_codes.append(1)

    server_code = start_local_server(record=True)
    return_codes.append(server_code)
    if server_code == 0:
        return_codes.append(run_direct_security_probes(prompt_screenshot=False))
        # Restart the tracked server after the rate-limit probe so the performance
        # evidence is not affected by exhausted in-memory rate-limit counters.
        if SERVER_PROCESS is not None:
            stop_local_server(quiet_if_none=True, record=False)
            return_codes.append(start_local_server(record=True))
        return_codes.append(run_performance_test(prompt_screenshot=False))
        check_health(timeout_seconds=3, record=True)

    stop_local_server(quiet_if_none=True, record=True)
    finish_run()

    print()
    answer = input("Take one final terminal screenshot of this evidence run? [y/N]: ").strip().lower()
    if answer == "y":
        print("Capturing in 2 seconds. Keep this terminal selected and visible.")
        time.sleep(2)
        capture_terminal_screenshot("complete-evidence-suite")

    return 0 if all(code == 0 for code in return_codes) and overall_status() == "PASS" else 1


def open_local_app() -> int:
    import webbrowser

    print("Opening http://localhost:3000 in the default browser.")
    webbrowser.open(LOCAL_BASE_URL)
    print()
    print("Manual weekly rota check:")
    print("1. Log in with the local evidence manager account.")
    print("2. Go to Weekly rota.")
    print("3. Check the department tabs and week controls.")
    print("4. Click Populate next week.")
    print("5. Review the draft before saving anything.")
    print("6. Click Try again and confirm the same next week is rebuilt.")
    print("7. Use Dismiss if this is only a test.")
    record_result(
        "Open local application",
        "PASS",
        category="Manual testing support",
        details="Opened the local application and printed the manual workflow.",
    )
    return 0


def capture_terminal_screenshot(label: str = "terminal-result") -> Path | None:
    ensure_run("terminal-screenshot")
    assert CURRENT_EVIDENCE_DIR is not None
    safe_label = safe_slug(label)
    screenshot_path = CURRENT_EVIDENCE_DIR / f"{now_stamp()}_{safe_label}.png"

    if platform.system().lower() != "windows":
        print("Automated terminal screenshot capture is available on Windows only.")
        record_result(
            "Terminal screenshot",
            "SKIP",
            category="Evidence capture",
            details="Non-Windows platform detected.",
        )
        return None

    ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$nativeSource = @"
using System;
using System.Runtime.InteropServices;

public class ActiveWindowCapture {{
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {{
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }}

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}}
"@

Add-Type -TypeDefinition $nativeSource
$windowHandle = [ActiveWindowCapture]::GetForegroundWindow()
if ($windowHandle -eq [IntPtr]::Zero) {{ throw "No active window." }}
$rect = New-Object ActiveWindowCapture+RECT
if (-not [ActiveWindowCapture]::GetWindowRect($windowHandle, [ref]$rect)) {{
  throw "Could not read active window bounds."
}}
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) {{ throw "Empty window bounds." }}
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $width, $height))
$bitmap.Save('{str(screenshot_path).replace("'", "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
"""

    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
        cwd=str(REPO_ROOT),
        text=True,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0:
        details = result.stderr.strip() or "Unknown PowerShell screenshot error."
        print(f"Screenshot capture failed: {details}")
        record_result(
            "Terminal screenshot",
            "FAIL",
            category="Evidence capture",
            details=details,
        )
        return None

    print(f"Saved screenshot: {screenshot_path}")
    record_result(
        "Terminal screenshot",
        "PASS",
        category="Evidence capture",
        details=f"Saved {screenshot_path.name}.",
        evidence_file=screenshot_path,
    )
    return screenshot_path


def prompt_for_screenshot(label: str) -> None:
    print()
    answer = input("Take a screenshot of the terminal result now? [y/N]: ").strip().lower()
    if answer != "y":
        return
    print("Capturing in 2 seconds. Keep this terminal window selected and visible.")
    time.sleep(2)
    capture_terminal_screenshot(label)


def show_latest_logs() -> int:
    ensure_directories()
    raw_files = sorted(
        [path for path in LOG_ROOT.rglob("*") if path.is_file()],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    evidence_files = sorted(
        [path for path in EVIDENCE_ROOT.rglob("*") if path.is_file()],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )

    print()
    print("Latest raw logs")
    print("-" * 72)
    if not raw_files:
        print("No raw logs found.")
    for path in raw_files[:10]:
        print(f"{path.relative_to(REPO_ROOT)} ({path.stat().st_size} bytes)")

    print()
    print("Latest curated evidence")
    print("-" * 72)
    if not evidence_files:
        print("No curated evidence found.")
    for path in evidence_files[:10]:
        print(f"{path.relative_to(REPO_ROOT)} ({path.stat().st_size} bytes)")

    record_result(
        "Show latest evidence files",
        "PASS",
        category="Evidence management",
        details=f"Raw files={len(raw_files)}; evidence files={len(evidence_files)}.",
    )
    return 0


def print_menu() -> None:
    print()
    print("Choose a test action")
    print("-" * 72)
    print("1. Check tools, local environment, tests, and scope consistency")
    print("2. Check installs and optionally run npm ci")
    print("3. Create/update local evidence environment and database")
    print("4. Run local evidence database check")
    print("5. Run local evidence migrations and seed")
    print("6. Run full backend Jest suite")
    print("7. Run security and access-control Jest tests")
    print("8. Run core workflow route Jest tests")
    print("9. Run npm dependency security audit")
    print("10. Validate the complete npm dependency tree")
    print("11. Start local evidence server and check health")
    print("12. Check http://localhost:3000/health")
    print("13. Run direct local HTTP security probes")
    print("14. Run local concurrent performance test")
    print("15. Run complete automated evidence suite")
    print("16. Stop server started by this menu")
    print("17. Open local app and print manual rota steps")
    print("18. Take terminal screenshot now")
    print("19. Show latest raw logs and curated evidence")
    print("0. Exit")


def main() -> int:
    register_cleanup_handlers()
    print_header()

    actions: dict[str, tuple[str, Callable[[], Any]]] = {
        "1": ("environment-check", check_tools),
        "2": ("install-check", check_install_needs),
        "3": ("local-database-setup", setup_local_database),
        "4": ("local-database-check", local_evidence_check),
        "5": ("local-database-migrate-seed", local_evidence_all),
        "6": ("full-jest-suite", run_full_backend_tests),
        "7": ("security-jest-suite", run_security_tests),
        "8": ("workflow-jest-suite", run_workflow_tests),
        "9": ("dependency-audit", run_dependency_audit),
        "10": ("dependency-tree", run_dependency_tree_check),
        "11": ("start-local-server", start_local_server),
        "12": ("health-check", check_health),
        "13": ("direct-security-probes", run_direct_security_probes),
        "14": ("performance-test", run_performance_test),
        "15": ("complete-evidence-suite", run_complete_evidence_suite),
        "16": ("stop-local-server", stop_local_server),
        "17": ("open-local-app", open_local_app),
        "18": ("terminal-screenshot", capture_terminal_screenshot),
        "19": ("show-evidence", show_latest_logs),
    }

    while True:
        print_menu()
        choice = input("Enter option number: ").strip()
        if choice == "0":
            stop_local_server(quiet_if_none=True, record=False)
            print("Done.")
            return 0

        action_entry = actions.get(choice)
        if action_entry is None:
            print("Unknown option.")
            continue

        label, action = action_entry
        begin_run(label)
        try:
            result = action()
            if type(result) is int:
                print(f"Action finished with exit code {result}.")
            elif type(result) is bool:
                print(f"Action finished: {'PASS' if result else 'FAIL'}.")
        except KeyboardInterrupt:
            print()
            print("Action interrupted.")
            record_result(
                label,
                "FAIL",
                category="Execution",
                details="Action interrupted by the user.",
            )
        except Exception as error:
            print()
            print(f"Action failed: {error}")
            record_result(
                label,
                "FAIL",
                category="Execution",
                details=f"Unhandled error: {error}",
            )
        finally:
            finish_run()


if __name__ == "__main__":
    raise SystemExit(main())
