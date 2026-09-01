# 05 — Fingerprint Discord-hosted images safely

**What to build:** Every eligible Discord-hosted attachment and proxied visible embed image is streamed once through bounded, validated exact fingerprinting without storing raw runtime images.

**Blocked by:** 03 — Evaluate explainable Assessments.

**Status:** ready-for-agent

- [ ] Attachments and embed image/thumbnail fields become Image sources; decorative and non-image media do not.
- [ ] Approved Discord CDN/proxy HTTPS hosts are preferred and validated.
- [ ] Every Image source is processed without a per-message count cutoff and with bounded concurrency.
- [ ] Defaults enforce 10 MiB per image and a ten-second timeout.
- [ ] PNG, JPEG, GIF, and WebP are accepted by signature rather than filename or declared MIME type.
- [ ] The complete GIF file is hashed without frame decoding.
- [ ] SHA-256 is calculated while streaming and bytes are discarded immediately.
- [ ] One failed image adds a named non-scoring diagnostic while remaining images continue.
- [ ] Multi-image, malformed, oversized, stalled, and unsupported-image scenarios pass.
