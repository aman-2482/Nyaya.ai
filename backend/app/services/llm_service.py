"""
NyayaAI – LLM Service
=======================
Async client for OpenRouter chat completions.
Handles request construction, response parsing, and structured output.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from app.config import settings
from app.rag.prompts import build_messages


# ══════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════════════════════════════════════════


async def call_llm(
    user_query: str,
    context_chunks: List[Dict[str, Any]],
    language: str = "en",
) -> Dict[str, Any]:
    """
    Send a prompt to the OpenRouter LLM and return a structured legal response.

    Returns:
        Parsed dict with keys: summary, relevant_law, your_rights,
        next_steps, disclaimer.  Every value is guaranteed to be either
        a plain string or a list of strings.
    """

    messages = build_messages(user_query, context_chunks, language)

    payload = {
        "model": settings.MODEL_NAME,
        "messages": messages,
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": settings.LLM_MAX_TOKENS,
        "top_p": 0.9,
    }

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nyayaai.vercel.app",
        "X-Title": "NyayaAI Legal Assistant",
    }

    logger.info("Calling OpenRouter model: {model}", model=settings.MODEL_NAME)

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            settings.OPENROUTER_BASE_URL,
            json=payload,
            headers=headers,
        )
        response.raise_for_status()

    data = response.json()
    raw_content = data["choices"][0]["message"]["content"]

    logger.debug("Raw LLM response length: {n} chars", n=len(raw_content))
    logger.debug("Raw LLM content (first 500): {c}", c=raw_content[:500])

    # ── Parse structured JSON from model output ──────────────────────
    parsed = _extract_json(raw_content)

    # If first attempt failed, try stripping LLM preamble text
    if parsed is None:
        stripped = re.sub(r"^[^\{]*(?=\{)", "", raw_content, count=1).strip()
        if stripped.startswith("{"):
            parsed = _extract_json(stripped)

    # Try repairing (handles unescaped newlines inside strings)
    if parsed is None:
        parsed = _repair_and_parse_json(raw_content)

    # Try recovering truncated JSON
    if parsed is None:
        parsed = _recover_truncated_json(raw_content)

    # If summary itself contains embedded JSON, unwrap it
    if parsed is not None:
        summary_val = parsed.get("summary", "")
        if isinstance(summary_val, str) and len(summary_val) > 50:
            trimmed = summary_val.strip()
            if (
                "```" in trimmed
                or (trimmed.startswith("{") and '"summary"' in trimmed)
            ):
                inner = _extract_json(summary_val)
                if inner is None:
                    inner = _repair_and_parse_json(summary_val)
                if inner and isinstance(inner, dict) and "summary" in inner:
                    inner_sum = inner.get("summary", "")
                    if isinstance(inner_sum, str) and not inner_sum.strip().startswith("{"):
                        parsed = inner

    # ── Final fallback: use raw text as summary ──────────────────────
    if parsed is None:
        logger.warning("Could not parse structured JSON; using raw text as summary.")
        parsed = {
            "summary": _clean_raw_text(raw_content),
            "relevant_law": "",
            "your_rights": "",
            "next_steps": [],
            "disclaimer": (
                "This is informational only and does not constitute legal advice. "
                "Please consult a qualified lawyer for your specific situation."
            ),
        }

    # ── Normalise all fields to plain strings / list[str] ────────────
    parsed = _normalise_fields(parsed)

    # Ensure disclaimer
    if not parsed.get("disclaimer"):
        parsed["disclaimer"] = (
            "This is informational only and does not constitute legal advice. "
            "Please consult a qualified lawyer for your specific situation."
        )

    return parsed


# ══════════════════════════════════════════════════════════════════════════
# FIELD NORMALISATION
# ══════════════════════════════════════════════════════════════════════════


def _normalise_fields(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guarantee every field is the correct type.
    - summary, relevant_law, your_rights, disclaimer → str
    - next_steps → List[str]
    Flatten nested objects/arrays into readable strings.
    """
    for key in ("summary", "relevant_law", "your_rights", "disclaimer"):
        val = parsed.get(key, "")
        parsed[key] = _flatten_to_string(val)
        # Strip any leftover markdown formatting
        parsed[key] = _strip_markdown(parsed[key])

    # Handle next_steps
    ns = parsed.get("next_steps", [])
    if isinstance(ns, str):
        # Split string into list
        parsed["next_steps"] = [
            _strip_markdown(s.strip()) for s in re.split(r"\n+", ns) if s.strip()
        ]
    elif isinstance(ns, list):
        clean_steps = []
        for item in ns:
            s = _flatten_to_string(item)
            s = _strip_markdown(s.strip())
            # Remove leading numbering like "1. " or "Step 1: "
            s = re.sub(r"^(?:Step\s*)?\d+[\.\):\-]\s*", "", s, flags=re.IGNORECASE)
            if s:
                clean_steps.append(s)
        parsed["next_steps"] = clean_steps
    else:
        parsed["next_steps"] = []

    return parsed


def _flatten_to_string(val: Any) -> str:
    """Convert any value (str, list, dict, nested structures) to a readable string."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, list):
        parts = []
        for item in val:
            if isinstance(item, dict):
                # e.g. {"act": "Consumer Protection Act", "sections": [...]}
                readable = _dict_to_readable(item)
                if readable:
                    parts.append(readable)
            elif isinstance(item, str):
                parts.append(item.strip())
            else:
                parts.append(str(item))
        return "; ".join(parts) if parts else ""
    if isinstance(val, dict):
        return _dict_to_readable(val)
    return str(val)


def _dict_to_readable(d: Dict[str, Any]) -> str:
    """Convert a dict like {"act": "...", "sections": [...]} to readable text."""
    parts = []
    for key, value in d.items():
        if isinstance(value, list):
            joined = ", ".join(str(v) for v in value)
            parts.append(f"{key}: {joined}")
        elif isinstance(value, dict):
            parts.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
        elif value:
            parts.append(f"{key}: {value}")
    return ". ".join(parts) if parts else ""


def _strip_markdown(text: str) -> str:
    """Remove markdown bold/italic markers from text."""
    if not text:
        return ""
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"(?<!\w)\*([^*]+?)\*(?!\w)", r"\1", text)
    text = re.sub(r"(?<!\w)_([^_]+?)_(?!\w)", r"\1", text)
    return text


def _clean_raw_text(raw_content: str) -> str:
    """Clean raw LLM output when JSON parsing completely fails."""
    text = raw_content.strip()
    # Remove code fences
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?\s*```\s*$", "", text)
    # If the text looks like a JSON wrapper, extract the summary value
    m = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    if m:
        extracted = m.group(1)
        extracted = extracted.replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t")
        return extracted
    return text


# ══════════════════════════════════════════════════════════════════════════
# JSON EXTRACTION & PARSING
# ══════════════════════════════════════════════════════════════════════════


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract a JSON object from the LLM output.
    Handles markdown code fences, nested JSON, and common formatting issues.
    """
    # Strip markdown code fences
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    # Try balanced-brace parsing
    parsed = _parse_balanced_json(cleaned)
    if parsed is None:
        return None

    # Post-process: if a field itself contains fenced JSON, unwrap it
    summary = parsed.get("summary", "")
    if isinstance(summary, str) and summary.strip().startswith("```"):
        inner_cleaned = re.sub(r"^```(?:json)?\s*\n?", "", summary.strip())
        inner_cleaned = re.sub(r"\n?\s*```\s*$", "", inner_cleaned)
        inner = _parse_balanced_json(inner_cleaned.strip())
        if inner and isinstance(inner, dict) and "summary" in inner:
            parsed = inner

    # Strip code fences from individual fields
    for key in ("summary", "relevant_law", "your_rights", "disclaimer"):
        val = parsed.get(key, "")
        if isinstance(val, str):
            val = re.sub(r"^```(?:json)?\s*\n?", "", val)
            val = re.sub(r"\n?\s*```\s*$", "", val)
            parsed[key] = val.strip()

    return parsed


def _recover_truncated_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Attempt to recover a truncated JSON response by closing open structures.
    The LLM often runs out of tokens mid-response, leaving unclosed braces.
    """
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    start = cleaned.find("{")
    if start == -1:
        return None

    fragment = cleaned[start:]

    # Count unclosed braces and brackets
    in_string = False
    escape = False
    open_braces = 0
    open_brackets = 0

    for ch in fragment:
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            open_braces += 1
        elif ch == "}":
            open_braces -= 1
        elif ch == "[":
            open_brackets += 1
        elif ch == "]":
            open_brackets -= 1

    if open_braces <= 0 and open_brackets <= 0:
        return None  # Not actually truncated

    # Try to close the fragment
    # First, if we're inside a string, close it
    # Count quotes to determine if we're in a string
    in_str = False
    esc = False
    for ch in fragment:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str

    repaired = fragment
    if in_str:
        repaired += '"'

    # Now close brackets and braces
    repaired += "]" * max(0, open_brackets)
    repaired += "}" * max(0, open_braces)

    try:
        result = json.loads(repaired)
        if isinstance(result, dict):
            logger.info("Recovered truncated JSON successfully")
            return result
    except json.JSONDecodeError:
        pass

    # More aggressive: try to repair newlines first, then close
    repaired_text = _repair_newlines(fragment)
    in_str = False
    esc = False
    for ch in repaired_text:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str

    if in_str:
        repaired_text += '"'

    # Recount braces
    ob, osb = 0, 0
    in_s, es = False, False
    for ch in repaired_text:
        if es:
            es = False
            continue
        if ch == "\\":
            es = True
            continue
        if ch == '"':
            in_s = not in_s
            continue
        if in_s:
            continue
        if ch == "{": ob += 1
        elif ch == "}": ob -= 1
        elif ch == "[": osb += 1
        elif ch == "]": osb -= 1

    repaired_text += "]" * max(0, osb)
    repaired_text += "}" * max(0, ob)

    try:
        result = json.loads(repaired_text)
        if isinstance(result, dict):
            logger.info("Recovered truncated JSON (with newline repair) successfully")
            return result
    except json.JSONDecodeError:
        pass

    return None


def _repair_newlines(text: str) -> str:
    """Escape unescaped newlines inside JSON strings."""
    chars = []
    in_string = False
    escape = False

    for ch in text:
        if escape:
            chars.append(ch)
            escape = False
            continue
        if ch == "\\":
            chars.append(ch)
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            chars.append(ch)
            continue
        if in_string and ch == "\n":
            chars.append("\\n")
        elif in_string and ch == "\r":
            pass
        elif in_string and ch == "\t":
            chars.append("\\t")
        else:
            chars.append(ch)

    return "".join(chars)


def _repair_and_parse_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Attempt to repair invalid JSON strings (e.g. unescaped newlines inside quotes)
    and parse them.
    """
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", text.strip())
    cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    repaired = _repair_newlines(cleaned)
    return _parse_balanced_json(repaired)


def _parse_balanced_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Find the first balanced { ... } in text and parse it as JSON.
    This is more reliable than regex for nested objects.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start : i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    # Try to find another JSON object later in the text
                    next_start = text.find("{", i + 1)
                    if next_start != -1:
                        return _parse_balanced_json(text[next_start:])
                    return None

    return None
