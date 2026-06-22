"""
CLI Adapter for Cursor.

Cursor-only fork: abstracts Trellis paths and command layout for Cursor IDE.

Usage:
    from common.cli_adapter import CLIAdapter

    adapter = CLIAdapter("cursor")
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar, Literal

Platform = Literal["cursor"]


@dataclass
class CLIAdapter:
    """Adapter for Cursor IDE integration."""

    platform: Platform

    _AGENT_NAME_MAP: ClassVar[dict[Platform, dict[str, str]]] = {
        "cursor": {},
    }

    def get_agent_name(self, agent: str) -> str:
        mapping = self._AGENT_NAME_MAP.get(self.platform, {})
        return mapping.get(agent, agent)

    @property
    def config_dir_name(self) -> str:
        return ".cursor"

    def get_config_dir(self, project_root: Path) -> Path:
        return project_root / self.config_dir_name

    def get_agent_path(self, agent: str, project_root: Path) -> Path:
        mapped_name = self.get_agent_name(agent)
        return self.get_config_dir(project_root) / "agents" / f"{mapped_name}.md"

    def get_commands_path(self, project_root: Path, *parts: str) -> Path:
        if not parts:
            return self.get_config_dir(project_root) / "commands"
        if len(parts) >= 2 and parts[0] == "trellis":
            filename = parts[-1]
            return (
                self.get_config_dir(project_root) / "commands" / f"trellis-{filename}"
            )
        return self.get_config_dir(project_root) / "commands" / Path(*parts)

    def get_trellis_command_path(self, name: str) -> str:
        return f".cursor/commands/trellis-{name}.md"

    def get_non_interactive_env(self) -> dict[str, str]:
        return {}

    def build_run_command(
        self,
        agent: str,
        prompt: str,
        session_id: str | None = None,
        skip_permissions: bool = True,
        verbose: bool = True,
        json_output: bool = True,
    ) -> list[str]:
        _ = (agent, prompt, session_id, skip_permissions, verbose, json_output)
        raise ValueError(
            "Cursor is IDE-only; CLI agent run is not supported. Use Cursor Agent in the IDE."
        )

    def build_resume_command(self, session_id: str) -> list[str]:
        _ = session_id
        raise ValueError("Cursor is IDE-only; CLI resume is not supported.")

    def get_resume_command_str(self, session_id: str, cwd: str | None = None) -> str:
        cmd = self.build_resume_command(session_id)
        cmd_str = " ".join(cmd)
        if cwd:
            return f"cd {cwd} && {cmd_str}"
        return cmd_str

    @property
    def is_cursor(self) -> bool:
        return True

    @property
    def cli_name(self) -> str:
        return "cursor"

    @property
    def supports_cli_agents(self) -> bool:
        return False

    @property
    def requires_agent_definition_file(self) -> bool:
        return True

    @property
    def supports_session_id_on_create(self) -> bool:
        return False

    def extract_session_id_from_log(self, log_content: str) -> str | None:
        _ = log_content
        return None


def get_cli_adapter(platform: str = "cursor") -> CLIAdapter:
    if platform != "cursor":
        raise ValueError(f"Unsupported platform: {platform} (must be 'cursor')")
    return CLIAdapter(platform="cursor")


_ALL_PLATFORM_CONFIG_DIRS = (".cursor",)


def _has_other_platform_dir(project_root: Path, exclude: set[str]) -> bool:
    return any(
        (project_root / d).is_dir()
        for d in _ALL_PLATFORM_CONFIG_DIRS
        if d not in exclude
    )


def detect_platform(project_root: Path) -> Platform:
    override = __import__("os").environ.get("TRELLIS_PLATFORM", "").strip().lower()
    if override == "cursor":
        return "cursor"
    if (project_root / ".cursor").is_dir():
        return "cursor"
    return "cursor"