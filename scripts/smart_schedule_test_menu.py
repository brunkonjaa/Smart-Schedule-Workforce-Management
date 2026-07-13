#!/usr/bin/env python3
"""
Local test menu for Smart Schedule.

This script is meant for a normal terminal window. It wraps the current backend
test commands, local evidence checks, and terminal evidence capture without
asking the user to remember every npm command.
"""

from __future__ import annotations

import getpass
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
LOCAL_ENV_PATH = BACKEND_DIR / "local-evidence.env"
LOCAL_ENV_EXAMPLE_PATH = BACKEND_DIR / "local-evidence.env.example"
LOG_ROOT = REPO_ROOT / "logs" / "local-test-menu"
TEST_DIR = BACKEND_DIR / "src" / "__tests__"
LOCAL_DATABASE_NAME = "smart_schedule_local"
LOCAL_HEALTH_URL = "http://localhost:3000/health"

SECURITY_TESTS = [
    "src/__tests__/auth-routes.test.js",
    "src/__tests__/auth-middleware.test.js",
    "src/__tests__/rate-limit.test.js",
    "src/__tests__/db-config.test.js",
    "src/__tests__/staff-routes.test.js",
    "src/__tests__/assignment-routes.test.js",
]

WORKFLOW_TESTS = [
    "src/__tests__/staff-routes.test.js",
    "src/__tests__/availability-routes.test.js",
    "src/__tests__/leave-routes.test.js",
    "src/__tests__/shift-routes.test.js",
    "src/__tests__/assignment-routes.test.js",
    "src/__tests__/rota-routes.test.js",
]

RECOMMENDATION_TESTS = [
    "src/__tests__/shift-recommendation-service.test.js",
    "src/__tests__/shift-recommendation-routes.test.js",
]

SERVER_PROCESS: subprocess.Popen[str] | None = None
SERVER_LOG_HANDLE = None


def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def ensure_log_root() -> None:
    LOG_ROOT.mkdir(parents=True, exist_ok=True)


def command_name(name: str) -> str:
    if os.name == "nt":
        cmd_name = f"{name}.cmd"
        if shutil.which(cmd_name):
            return cmd_name
    return name


def print_header() -> None:
    print()
    print("Smart Schedule local test menu")
    print("=" * 36)
    print(f"Repo: {REPO_ROOT}")
    print(f"Backend: {BACKEND_DIR}")
    print(f"Logs: {LOG_ROOT}")
    print()
    print("This menu uses backend/local-evidence.env for database tests.")
    print("It blocks database tests if the DATABASE_URL is not localhost or 127.0.0.1.")
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
        return parsed.hostname in {"localhost", "127.0.0.1"}
    except ValueError:
        return "localhost" in database_url or "127.0.0.1" in database_url


def require_local_env() -> dict[str, str] | None:
    if not LOCAL_ENV_PATH.exists():
        print()
        print("backend/local-evidence.env is missing.")
        print("Run option 2 first, or copy backend/local-evidence.env.example manually.")
        return None

    env_values = read_env_file(LOCAL_ENV_PATH)
    database_url = env_values.get("DATABASE_URL", "")
    if not is_local_database_url(database_url):
        print()
        print("Blocked: DATABASE_URL in backend/local-evidence.env is not local.")
        print("The test menu will not run database tests against Neon or another hosted DB.")
        return None

    return env_values


def command_env(use_local_env: bool = False, node_env: str | None = None) -> dict[str, str]:
    env = os.environ.copy()

    if use_local_env:
        env_values = require_local_env()
        if env_values is None:
            raise RuntimeError("local evidence env is not ready")
        env.update(env_values)

    if node_env:
        env["NODE_ENV"] = node_env

    return env


def redact_line(line: str) -> str:
    secret_line_patterns = [
        r"^\s*Manager password\s*:",
        r"^\s*Demo staff password\s*:",
        r"^\s*DATABASE_URL\s*=",
        r"^\s*SESSION_SECRET\s*=",
    ]

    for pattern in secret_line_patterns:
        if re.search(pattern, line, flags=re.IGNORECASE):
            label = line.split(":", 1)[0] if ":" in line else line.split("=", 1)[0]
            return f"{label.strip()}: [redacted]\n"

    return line


def run_command(
    title: str,
    command: list[str],
    cwd: Path,
    *,
    use_local_env: bool = False,
    node_env: str | None = None,
) -> int:
    ensure_log_root()
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    log_path = LOG_ROOT / f"{now_stamp()}_{slug}.txt"

    print()
    print(f"Running: {title}")
    print(f"Command: {' '.join(command)}")
    print(f"Output log: {log_path}")
    print("-" * 72)

    try:
        env = command_env(use_local_env=use_local_env, node_env=node_env)
    except RuntimeError as error:
        print(error)
        return 1

    with log_path.open("w", encoding="utf-8") as log_file:
        log_file.write(f"Smart Schedule test menu\n")
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
        log_file.write("-" * 72 + "\n")
        log_file.write(f"Exit code: {return_code}\n")
        log_file.write(f"Finished: {datetime.now().isoformat(timespec='seconds')}\n")

    print("-" * 72)
    print(f"Exit code: {return_code}")

    prompt_for_screenshot(f"{slug}-result")
    return return_code


def check_tools() -> None:
    print()
    print("Tool check")
    print("-" * 72)

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
        except FileNotFoundError:
            print(f"{label}: missing")

    print()
    if LOCAL_ENV_PATH.exists():
        database_url = local_database_url()
        local_status = "local" if is_local_database_url(database_url) else "not local"
        print(f"backend/local-evidence.env: found ({local_status})")
    elif LOCAL_ENV_EXAMPLE_PATH.exists():
        print("backend/local-evidence.env: missing, example file exists")
    else:
        print("backend/local-evidence.env: missing, example file also missing")

    test_files = sorted(TEST_DIR.glob("*.test.js"))
    print(f"Backend test files found: {len(test_files)}")
    for test_file in test_files:
        print(f"- {test_file.relative_to(BACKEND_DIR).as_posix()}")


def backend_packages_ready() -> bool:
    required_paths = [
        BACKEND_DIR / "node_modules" / "jest",
        BACKEND_DIR / "node_modules" / "supertest",
        BACKEND_DIR / "node_modules" / "pg",
        BACKEND_DIR / "node_modules" / "express",
    ]
    return all(path.exists() for path in required_paths)


def check_install_needs() -> int:
    print()
    print("Install check")
    print("-" * 72)

    missing_tools = []
    for tool in ["node", "npm"]:
        if shutil.which(command_name(tool)) is None and shutil.which(tool) is None:
            missing_tools.append(tool)

    if missing_tools:
        print(f"Missing required tool(s): {', '.join(missing_tools)}")
        print("Install Node.js from the official installer, then reopen the terminal.")
        print("This script will not install Node or npm automatically.")
        return 1

    if backend_packages_ready():
        print("Backend npm packages already look installed.")
        print("No npm install was run.")
        return 0

    print("Backend npm packages are missing or incomplete.")
    answer = input("Run npm install in backend now? [y/N]: ").strip().lower()
    if answer != "y":
        print("No install was run.")
        return 1

    return run_command(
        "Install backend npm packages",
        [command_name("npm"), "install"],
        BACKEND_DIR,
    )


def setup_local_database() -> int:
    print()
    print("Local evidence setup")
    print("-" * 72)
    print("This writes backend/local-evidence.env and tries to create smart_schedule_local.")
    print("It uses the local PostgreSQL postgres user only.")
    print("Your password will not be printed.")
    print()

    if not (BACKEND_DIR / "node_modules" / "pg").exists():
        print("backend/node_modules/pg is missing.")
        print("Run option 2 first so the setup script can use the project's pg package.")
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

    ensure_log_root()
    log_path = LOG_ROOT / f"{now_stamp()}_setup-local-database.txt"
    print(f"Setup log: {log_path}")
    print("-" * 72)

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

    print("-" * 72)
    print(f"Exit code: {return_code}")
    if return_code != 0:
        print("If this failed, check PostgreSQL is installed, running, and reachable on localhost:5432.")

    prompt_for_screenshot("setup-local-database")
    return return_code


def local_evidence_check() -> int:
    return run_command(
        "Local evidence check",
        [command_name("npm"), "run", "local:evidence:check"],
        BACKEND_DIR,
    )


def local_evidence_all() -> int:
    return run_command(
        "Migrate and seed local evidence database",
        [command_name("npm"), "run", "local:evidence:all"],
        BACKEND_DIR,
    )


def run_full_backend_tests() -> int:
    return run_command(
        "Full backend Jest suite",
        [command_name("npm"), "test"],
        BACKEND_DIR,
        use_local_env=True,
        node_env="test",
    )


def run_selected_tests(title: str, test_paths: list[str]) -> int:
    return run_command(
        title,
        [command_name("npm"), "test", "--", "--runTestsByPath", *test_paths],
        BACKEND_DIR,
        use_local_env=True,
        node_env="test",
    )


def run_security_tests() -> int:
    return run_selected_tests("Security and access-control Jest tests", SECURITY_TESTS)


def run_workflow_tests() -> int:
    return run_selected_tests("Core workflow route Jest tests", WORKFLOW_TESTS)


def run_recommendation_tests() -> int:
    return run_selected_tests("Recommendation Jest tests", RECOMMENDATION_TESTS)


def run_dependency_audit() -> int:
    return run_command(
        "npm dependency security audit",
        [command_name("npm"), "audit", "--audit-level=moderate"],
        BACKEND_DIR,
    )


def check_health(timeout_seconds: int = 3) -> bool:
    try:
        with urllib.request.urlopen(LOCAL_HEALTH_URL, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="replace")
            print(f"Health HTTP {response.status}: {body}")
            return response.status == 200 and '"status":"ok"' in body.replace(" ", "")
    except urllib.error.URLError as error:
        print(f"Health check failed: {error}")
        return False


def start_local_server() -> None:
    global SERVER_PROCESS, SERVER_LOG_HANDLE

    print()
    if check_health(timeout_seconds=1):
        print("Local server is already responding.")
        return

    try:
        env = command_env(use_local_env=True, node_env="development")
    except RuntimeError as error:
        print(error)
        return

    ensure_log_root()
    log_path = LOG_ROOT / f"{now_stamp()}_local-server.txt"
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

    for _ in range(20):
        time.sleep(0.5)
        if check_health(timeout_seconds=1):
            print("Server is ready at http://localhost:3000")
            print("Use option 12 to stop the server if this script started it.")
            return

    print("Server did not answer health check yet. Check the server log above.")


def stop_local_server(*, quiet_if_none: bool = False) -> None:
    global SERVER_PROCESS, SERVER_LOG_HANDLE

    if SERVER_PROCESS is None:
        if quiet_if_none:
            return
        print("This script has no tracked server process to stop.")
        print("If you started the server in another terminal, stop it there with Ctrl+C.")
        return

    print("Stopping local server started by this menu.")
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


def open_local_app() -> None:
    import webbrowser

    print("Opening http://localhost:3000 in the default browser.")
    webbrowser.open("http://localhost:3000")
    print()
    print("Manual recommendation check:")
    print("1. Log in with the local evidence manager account from docs/testing/local_evidence_workflow.md.")
    print("2. Go to Weekly rota.")
    print("3. Use week 2026-07-13 to 2026-07-19.")
    print("4. Use the BAR tab.")
    print("5. Open the 2026-07-15 shift 15:00 - 21:00.")
    print("6. Click Recommend staff.")
    print("7. Check ranked recommendation cards and excluded staff.")


def capture_terminal_screenshot(label: str = "terminal-result") -> Path | None:
    ensure_log_root()
    safe_label = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "terminal-result"
    screenshot_path = LOG_ROOT / f"{now_stamp()}_{safe_label}.png"

    system_name = platform.system().lower()
    if system_name != "windows":
        print("Screenshot capture is only automated on Windows in this script.")
        print(f"Command logs are still stored under {LOG_ROOT}.")
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
if ($windowHandle -eq [IntPtr]::Zero) {{
  throw "Could not find the active window to capture."
}}

$rect = New-Object ActiveWindowCapture+RECT
$ok = [ActiveWindowCapture]::GetWindowRect($windowHandle, [ref]$rect)
if (-not $ok) {{
  throw "Could not read the active window bounds."
}}

$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) {{
  throw "Active window bounds were empty."
}}

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
        print("Screenshot capture failed.")
        if result.stderr.strip():
            print(result.stderr.strip())
        return None

    print(f"Saved screenshot: {screenshot_path}")
    return screenshot_path


def prompt_for_screenshot(label: str) -> None:
    print()
    answer = input("Take a screenshot of the terminal result now? [y/N]: ").strip().lower()
    if answer != "y":
        return

    print("Capturing in 2 seconds. Keep this terminal window selected and visible.")
    time.sleep(2)
    capture_terminal_screenshot(label)


def show_latest_logs() -> None:
    ensure_log_root()
    files = sorted(LOG_ROOT.glob("*"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not files:
        print("No logs or screenshots found yet.")
        return

    print()
    print("Latest local test menu files")
    print("-" * 72)
    for path in files[:10]:
        size = path.stat().st_size
        print(f"{path.name} ({size} bytes)")


def print_menu() -> None:
    print()
    print("Choose a test action")
    print("-" * 72)
    print("1. Check tools, local env, and available test files")
    print("2. Check installs and optionally run npm install")
    print("3. Create/update local evidence env and database")
    print("4. Run local evidence database check")
    print("5. Run local evidence migrations and seed")
    print("6. Run full backend Jest suite")
    print("7. Run security and access-control Jest tests")
    print("8. Run core workflow route Jest tests")
    print("9. Run recommendation Jest tests")
    print("10. Run npm dependency security audit")
    print("11. Start local evidence server and check health")
    print("12. Check http://localhost:3000/health")
    print("13. Stop server started by this menu")
    print("14. Open local app and print manual recommendation steps")
    print("15. Take terminal screenshot now")
    print("16. Show latest local test logs/screenshots")
    print("0. Exit")


def main() -> int:
    print_header()

    actions = {
        "1": check_tools,
        "2": check_install_needs,
        "3": setup_local_database,
        "4": local_evidence_check,
        "5": local_evidence_all,
        "6": run_full_backend_tests,
        "7": run_security_tests,
        "8": run_workflow_tests,
        "9": run_recommendation_tests,
        "10": run_dependency_audit,
        "11": start_local_server,
        "12": check_health,
        "13": stop_local_server,
        "14": open_local_app,
        "15": capture_terminal_screenshot,
        "16": show_latest_logs,
    }

    while True:
        print_menu()
        choice = input("Enter option number: ").strip()
        if choice == "0":
            stop_local_server(quiet_if_none=True)
            print("Done.")
            return 0

        action = actions.get(choice)
        if action is None:
            print("Unknown option.")
            continue

        try:
            result = action()
            if type(result) is int:
                print(f"Action finished with exit code {result}.")
        except KeyboardInterrupt:
            print()
            print("Action interrupted.")
        except Exception as error:
            print()
            print(f"Action failed: {error}")


if __name__ == "__main__":
    raise SystemExit(main())
