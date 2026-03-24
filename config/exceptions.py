from __future__ import annotations

from typing import Any

from rest_framework.views import exception_handler


def _first_error_message(data: Any) -> str | None:
    """
    Pull a human-friendly message out of DRF's ValidationError shapes.

    Common shapes:
    - {"field": ["msg"]} / {"field": "msg"}
    - {"non_field_errors": ["msg"]}
    - ["msg"]
    """
    if data is None:
        return None

    if isinstance(data, list) and data:
        v = data[0]
        return v if isinstance(v, str) else str(v)

    if isinstance(data, dict) and data:
        # Prefer non-field errors if present.
        nfe = data.get("non_field_errors")
        if isinstance(nfe, list) and nfe:
            v = nfe[0]
            return v if isinstance(v, str) else str(v)

        for _k, v in data.items():
            if isinstance(v, list) and v:
                vv = v[0]
                return vv if isinstance(vv, str) else str(vv)
            if isinstance(v, str) and v:
                return v
            if isinstance(v, dict):
                nested = _first_error_message(v)
                if nested:
                    return nested

    return None


def api_exception_handler(exc, context):
    """
    Make 400 responses consistently include a top-level `detail` message.

    We keep the original error structure intact for forms/clients,
    but add a single student/admin-friendly message for toasts/popups.
    """
    response = exception_handler(exc, context)
    if response is None:
        return None

    if response.status_code == 400:
        data = response.data
        if isinstance(data, dict) and "detail" not in data:
            msg = _first_error_message(data)
            if msg:
                response.data["detail"] = msg
        elif isinstance(data, list):
            msg = _first_error_message(data)
            if msg:
                response.data = {"detail": msg, "errors": data}

    return response

