"""JSON CLI bridge to the TypeScript Kernel (P30 Stage 2 strangler).

Python create / start-execution / record-gate / archive submit a Kernel
Command. `task.json` status and gate extras are a same-command projection,
not a second core-state writer.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from .log import Colors, colored

TASK_RECORD_FIELDS = (
    "id",
    "name",
    "title",
    "description",
    "status",
    "dev_type",
    "scope",
    "package",
    "priority",
    "creator",
    "assignee",
    "createdAt",
    "completedAt",
    "branch",
    "base_branch",
    "worktree_path",
    "commit",
    "pr_url",
    "subtasks",
    "children",
    "parent",
    "relatedFiles",
    "notes",
    "meta",
)

_NULLABLE_STRING = {
    "dev_type",
    "scope",
    "package",
    "completedAt",
    "branch",
    "base_branch",
    "worktree_path",
    "commit",
    "pr_url",
    "parent",
}
_STRING_ARRAYS = {"subtasks", "children", "relatedFiles"}


class KernelCliNotFound(RuntimeError):
    """`cstl kernel --json` (or TRELLIS_KERNEL_CLI) is not available."""


class KernelCommandError(RuntimeError):
    """Kernel JSON CLI returned ok:false or could not be parsed."""

    def __init__(
        self,
        message: str,
        *,
        result: dict | None = None,
        returncode: int | None = None,
    ) -> None:
        super().__init__(message)
        self.result = result
        self.returncode = returncode


def to_kernel_record(task_data: dict) -> dict:
    """Project a Python task dict onto the canonical 24-field Kernel record."""
    record: dict = {}
    for field in TASK_RECORD_FIELDS:
        if field in task_data:
            record[field] = task_data[field]
            continue
        if field in _NULLABLE_STRING:
            record[field] = None
        elif field in _STRING_ARRAYS:
            record[field] = []
        elif field == "meta":
            record[field] = {}
        elif field == "priority":
            record[field] = "P2"
        elif field == "status":
            record[field] = "planning"
        elif field in ("description", "notes", "id", "name", "title", "creator", "assignee", "createdAt"):
            record[field] = ""
        else:
            record[field] = None
    if not isinstance(record["meta"], dict):
        record["meta"] = {}
    for array_field in _STRING_ARRAYS:
        value = record[array_field]
        if not isinstance(value, list):
            record[array_field] = []
    return record


def kernel_cli_argv() -> list[str]:
    override = os.environ.get("TRELLIS_KERNEL_CLI", "").strip()
    if override:
        if sys.platform == "win32":
            import shlex

            return shlex.split(override, posix=False)
        import shlex

        return shlex.split(override)
    cstl = shutil.which("cstl")
    if cstl:
        return [cstl, "kernel", "--json"]
    raise KernelCliNotFound(
        "Kernel CLI not found. Set TRELLIS_KERNEL_CLI or put `cstl` on PATH. "
        "Stage 2 create/start-execution/record-gate/archive require `cstl kernel --json`."
    )


def run_kernel_command(payload: dict, *, cwd: Path | None = None) -> dict:
    """Send one Kernel Command on stdin and parse one JSON object from stdout."""
    argv = kernel_cli_argv()
    encoded = json.dumps(payload, ensure_ascii=False)
    try:
        proc = subprocess.run(
            argv,
            input=encoded,
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=str(cwd) if cwd is not None else None,
            check=False,
        )
    except OSError as err:
        raise KernelCommandError(f"failed to invoke Kernel CLI {argv!r}: {err}") from err

    raw = (proc.stdout or "").strip()
    parsed: dict | None = None
    if raw:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            last_line = raw.splitlines()[-1] if raw.splitlines() else raw
            try:
                parsed = json.loads(last_line)
            except json.JSONDecodeError:
                parsed = None

    if not isinstance(parsed, dict):
        err_tail = (proc.stderr or "").strip()[-800:]
        raise KernelCommandError(
            f"Kernel CLI did not return JSON (exit {proc.returncode}). {err_tail}",
            returncode=proc.returncode,
        )

    if not parsed.get("ok"):
        error = parsed.get("error") if isinstance(parsed.get("error"), dict) else {}
        code = error.get("code", "UNKNOWN")
        message = error.get("message", "kernel command failed")
        raise KernelCommandError(
            f"Kernel {payload.get('op', 'command')} failed ({code}): {message}",
            result=parsed,
            returncode=proc.returncode,
        )
    return parsed


def kernel_read(task_dir: Path) -> dict:
    return run_kernel_command({"op": "read", "taskDir": str(task_dir)})


def kernel_expected_revision(task_dir: Path) -> int:
    result = kernel_read(task_dir)
    kernel = result.get("kernel")
    if not isinstance(kernel, dict):
        raise KernelCommandError("Kernel read did not include kernel.revision", result=result)
    revision = kernel.get("revision")
    if not isinstance(revision, int) or revision < 0:
        raise KernelCommandError(
            f"Kernel revision is invalid: {revision!r}",
            result=result,
        )
    return revision


def kernel_create(
    task_dir: Path,
    record: dict,
    *,
    actor: str,
    idempotency_key: str,
    evidence: str | None = None,
) -> dict:
    payload: dict = {
        "op": "create",
        "taskDir": str(task_dir),
        "actor": actor,
        "idempotencyKey": idempotency_key,
        "record": to_kernel_record(record),
    }
    if evidence:
        payload["evidence"] = evidence
    return run_kernel_command(payload)


def kernel_start(
    task_dir: Path,
    record: dict,
    extras: dict,
    *,
    expected_revision: int,
    actor: str,
    idempotency_key: str,
    evidence: str | None = None,
) -> dict:
    payload: dict = {
        "op": "start",
        "taskDir": str(task_dir),
        "expectedRevision": expected_revision,
        "actor": actor,
        "idempotencyKey": idempotency_key,
        "record": to_kernel_record(record),
        "extras": extras,
    }
    if evidence:
        payload["evidence"] = evidence
    return run_kernel_command(payload)


def kernel_record_gate(
    task_dir: Path,
    *,
    expected_revision: int,
    actor: str,
    idempotency_key: str,
    transition: str,
    gate: str,
    record: dict,
    extras: dict,
    evidence: str | None = None,
) -> dict:
    payload: dict = {
        "op": "record-gate",
        "taskDir": str(task_dir),
        "expectedRevision": expected_revision,
        "actor": actor,
        "idempotencyKey": idempotency_key,
        "transition": transition,
        "gate": gate,
        "record": record,
        "extras": extras,
    }
    if evidence:
        payload["evidence"] = evidence
    return run_kernel_command(payload)


def kernel_archive(
    task_dir: Path,
    record: dict,
    extras: dict,
    *,
    expected_revision: int,
    actor: str,
    idempotency_key: str,
    evidence: str | None = None,
) -> dict:
    payload: dict = {
        "op": "archive",
        "taskDir": str(task_dir),
        "expectedRevision": expected_revision,
        "actor": actor,
        "idempotencyKey": idempotency_key,
        "record": to_kernel_record(record),
        "extras": extras,
    }
    if evidence:
        payload["evidence"] = evidence
    return run_kernel_command(payload)


def print_kernel_error(err: Exception) -> None:
    print(colored(f"Error: {err}", Colors.RED), file=sys.stderr)
    if isinstance(err, KernelCommandError) and isinstance(err.result, dict):
        half = err.result.get("halfConversion")
        if isinstance(half, dict) and half.get("kernelPersisted"):
            print(
                colored(
                    "Kernel.json was committed but the task.json projection did not finish "
                    "(half-conversion). Re-run the same command to recover; do not treat this as success.",
                    Colors.YELLOW,
                ),
                file=sys.stderr,
            )
