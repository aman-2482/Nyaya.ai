"""
NyayaAI – Security Utilities
==============================
Input sanitisation and validation to prevent prompt injection and abuse.
"""

import re
from loguru import logger


# ── Patterns that indicate prompt-injection attempts ──────────────────────
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+(all\s+)?above\s+instructions",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(all\s+)?previous",
    r"you\s+are\s+now\s+a",
    r"act\s+as\s+if\s+you",
    r"pretend\s+you\s+are",
    r"system\s*:\s*",
    r"<\|?(system|im_start|im_end)\|?>",
    r"\[INST\]",
    r"\[\/INST\]",
]

_compiled_patterns = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def sanitize_input(text: str) -> str:
    """
    Sanitise user input:
    1. Strip leading/trailing whitespace.
    2. Remove null bytes and control characters.
    3. Collapse excessive whitespace.
    4. Check for prompt-injection patterns (log a warning but do NOT block – the LLM
       system prompt is the real guard; blocking outright creates false positives).

    Returns the cleaned text.
    """
    # Step 1 – strip
    text = text.strip()

    # Step 2 – remove null bytes and non-printable control chars (keep newlines, tabs)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Step 3 – collapse whitespace runs
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Step 4 – injection detection (warn only)
    for pattern in _compiled_patterns:
        if pattern.search(text):
            logger.warning(
                "Potential prompt-injection detected in input: {pattern}",
                pattern=pattern.pattern,
            )
            break  # one warning is enough

    return text


def validate_query_length(text: str, min_length: int = 5, max_length: int = 2000) -> str:
    """
    Validate that the query length is within acceptable bounds.
    Raises ValueError if out of range.
    """
    if len(text) < min_length:
        raise ValueError(
            f"Query too short. Minimum length is {min_length} characters."
        )
    if len(text) > max_length:
        raise ValueError(
            f"Query too long. Maximum length is {max_length} characters."
        )
    return text
