"""House style for model output: no em or en dashes.

DOME copy never uses the em dash (U+2014) or the en dash (U+2013) as
punctuation. The system prompt asks the model not to write them; this module
removes any that still come back, so generated text reads like the rest of
the product. It is deterministic and only ever touches those two characters.
"""

from __future__ import annotations

import re
from typing import Any

DASHES = "\N{EN DASH}\N{EM DASH}"

# A dash that opens a line works as a bullet: keep it as a hyphen bullet.
_LEADING_DASH = re.compile(r"(?m)^([ \t]*)[\N{EN DASH}\N{EM DASH}]+[ \t]*")
# A dash that closes a line or the text is dropped.
_TRAILING_DASH = re.compile(r"(?m)[ \t]*[\N{EN DASH}\N{EM DASH}]+[ \t]*$")
# An en dash joining two word characters is a range or a compound ("8-15", "Q1-Q2").
_JOINING_EN_DASH = re.compile(r"(?<=\w)\N{EN DASH}(?=\w)")
# Any other dash separates clauses: a comma reads naturally in its place, unless
# punctuation already follows the dash, in which case the dash is just dropped.
_CLAUSE_DASH = re.compile(r"[ \t]*[\N{EN DASH}\N{EM DASH}]+[ \t]*([,.;:!?)]?)")


def strip_dashes(text: str) -> str:
    """Return ``text`` with every em and en dash replaced by plain punctuation."""
    if not any(dash in text for dash in DASHES):
        return text
    if not text.strip(DASHES + " \t"):
        # A bare dash used as an empty value.
        return "N/A"
    text = _LEADING_DASH.sub(r"\1- ", text)
    text = _TRAILING_DASH.sub("", text)
    text = _JOINING_EN_DASH.sub("-", text)
    return _CLAUSE_DASH.sub(lambda match: match.group(1) or ", ", text)


def strip_dashes_deep(value: Any) -> Any:
    """Apply :func:`strip_dashes` to every string in a JSON-like structure.

    Dict keys are left alone: they are schema field names, not prose.
    """
    if isinstance(value, str):
        return strip_dashes(value)
    if isinstance(value, list):
        return [strip_dashes_deep(item) for item in value]
    if isinstance(value, dict):
        return {key: strip_dashes_deep(item) for key, item in value.items()}
    return value
