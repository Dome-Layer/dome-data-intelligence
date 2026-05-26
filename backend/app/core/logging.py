from dome_core.logging import configure_logging as _configure_logging
from dome_core.logging import get_logger


def configure_logging(environment: str = "development") -> None:
    _configure_logging(environment=environment)


__all__ = ["configure_logging", "get_logger"]
