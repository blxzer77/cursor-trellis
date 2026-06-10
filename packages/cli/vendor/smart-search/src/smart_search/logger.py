import logging
import os
from datetime import datetime
from .config import config

logger = logging.getLogger("smart_search")
logger.setLevel(getattr(logging, config.log_level))
logger.addHandler(logging.NullHandler())


def _file_logging_enabled() -> bool:
    return config.debug_enabled or config.log_to_file_enabled


def _configure_file_logging() -> None:
    if not _file_logging_enabled():
        return
    if any(isinstance(handler, logging.FileHandler) for handler in logger.handlers):
        return

    log_dir = config.log_dir
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"smart_search_{datetime.now().strftime('%Y%m%d')}.log"

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(getattr(logging, config.log_level))

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)


_configure_file_logging()

async def log_info(ctx, message: str, is_debug: bool = False):
    if is_debug:
        logger.info(message)

    if ctx:
        await ctx.info(message)
