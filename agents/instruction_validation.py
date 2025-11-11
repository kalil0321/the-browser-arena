"""
Instruction validation utility for basic input validation

This module provides basic validation functions for user instructions before they
are passed to LLM-powered browser automation agents.
Security is primarily handled through improved agent prompting.
"""

import os
from typing import Optional, Tuple

# Maximum instruction length (configurable via environment variable)
MAX_INSTRUCTION_LENGTH = int(os.getenv("MAX_INSTRUCTION_LENGTH", "5000"))


class ValidationError(Exception):
    """Exception raised when instruction validation fails"""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


def validate_instruction(instruction: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validates an instruction for basic input validation

    Args:
        instruction: The user instruction to validate

    Returns:
        Tuple of (is_valid, error_message, None) - third value kept for compatibility
    """
    # Check if instruction is provided
    if not instruction or not isinstance(instruction, str):
        return False, "Instruction is required and must be a string", None

    # Check length
    if len(instruction) > MAX_INSTRUCTION_LENGTH:
        return (
            False,
            f"Instruction is too long. Maximum length is {MAX_INSTRUCTION_LENGTH} characters.",
            None,
        )

    # Check for empty or whitespace-only instructions
    if not instruction.strip():
        return False, "Instruction cannot be empty", None

    return True, None, None


def sanitize_instruction(instruction: str) -> str:
    """
    Sanitizes an instruction by truncating if necessary

    Args:
        instruction: The instruction to sanitize

    Returns:
        Sanitized instruction
    """
    if not instruction or not isinstance(instruction, str):
        return ""

    sanitized = instruction

    # Truncate if necessary
    if len(sanitized) > MAX_INSTRUCTION_LENGTH:
        sanitized = sanitized[:MAX_INSTRUCTION_LENGTH]

    # Trim whitespace
    sanitized = sanitized.strip()

    return sanitized


def log_validation_failure(
    instruction: str,
    error_message: str,
    blocked_pattern: Optional[str],
    user_id: Optional[str] = None,
    context: Optional[str] = None,
) -> None:
    """
    Logs a validation failure for monitoring

    Args:
        instruction: The invalid instruction
        error_message: The validation error message
        blocked_pattern: Deprecated, kept for compatibility
        user_id: Optional user ID
        context: Additional context (e.g., route name)
    """
    import logging

    logger = logging.getLogger(__name__)

    log_data = {
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "validation_failed": True,
        "error": error_message,
        "instruction_length": len(instruction),
        "instruction_preview": instruction[:100],
        "user_id": user_id or "unknown",
        "context": context or "unknown",
    }

    # Log validation event
    logger.warning(f"[VALIDATION] Instruction validation failed: {log_data}")


def validate_instruction_field(value: str) -> str:
    """
    Pydantic validator function for instruction field
    Raises ValueError if validation fails

    Args:
        value: The instruction value to validate

    Returns:
        The validated instruction

    Raises:
        ValueError: If validation fails
    """
    is_valid, error_message, blocked_pattern = validate_instruction(value)

    if not is_valid:
        # Log the failure
        log_validation_failure(value, error_message or "", blocked_pattern)

        # Raise ValueError for Pydantic to catch
        raise ValueError(error_message or "Invalid instruction")

    return value

