# 06 — Fetch external embed images safely

**What to build:** Rendered external embed images remain inspectable when Discord provides no proxy, without allowing the bot to contact internal services or leak ambient credentials.

**Blocked by:** 05 — Fingerprint Discord-hosted images safely.

**Status:** completed

- [x] Fallback runs only for Discord-provided embed image/thumbnail media and only when no approved proxy exists.
- [x] `EXTERNAL_IMAGE_FETCH_ENABLED` defaults on and disables every origin fallback when false.
- [x] Only HTTP port 80 and HTTPS port 443 are accepted; URL credentials and custom ports are rejected.
- [x] DNS resolution rejects private, loopback, link-local, multicast, reserved, and metadata-service destinations.
- [x] The transport pins a validated public address while retaining hostname and TLS verification.
- [x] At most two redirects are followed and every destination is resolved, validated, and pinned again.
- [x] No cookie, authorization, or referrer is forwarded.
- [x] Standard byte, timeout, and signature limits apply; failures remain non-scoring diagnostics.
- [x] SSRF, DNS-rebinding, redirect, credential, HTTP, HTTPS, and disable-switch scenarios pass.
