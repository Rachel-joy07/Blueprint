"""
Azure Static Web Apps' built-in authentication (GitHub/Microsoft/etc,
"Easy Auth") needs zero identity-provider setup on your end - no app
registration, no client secret. Once someone signs in at
/.auth/login/github, SWA's proxy injects an `x-ms-client-principal`
header (base64-encoded JSON) onto every request it forwards to this
Functions API. This module just decodes that header.

Important local-dev note: this header ONLY appears when requests come
through the SWA proxy - i.e. the deployed site, or `swa start` locally.
Running `func start` directly (no SWA in front of it) means every
request looks anonymous, which is expected, not a bug.
"""

import base64
import json


def get_client_principal(req):
    """Returns {userId, userDetails, identityProvider, userRoles} for a
    signed-in request, or None for an anonymous one."""
    header = req.headers.get("x-ms-client-principal")
    if not header:
        return None
    try:
        decoded = base64.b64decode(header)
        principal = json.loads(decoded)
        return {
            "userId": principal.get("userId"),
            "userDetails": principal.get("userDetails"),
            "identityProvider": principal.get("identityProvider"),
            "userRoles": principal.get("userRoles", []),
        }
    except Exception:
        return None
