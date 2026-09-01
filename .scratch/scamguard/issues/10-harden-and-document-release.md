# 10 — Harden and document the initial release

**What to build:** A self-hosted operator can deploy, validate, monitor, and safely stop the completed ScamGuard release using complete documentation and production-like container behavior.

**Blocked by:** 06 — Fetch external embed images safely; 09 — Review and expire Incidents.

**Status:** ready-for-agent

- [ ] Structured logs cover Assessments, Incidents, actions, failures, and shutdown without secrets, message text, or runtime image bytes.
- [ ] Shutdown stops intake, drains in-flight bounded work, closes Discord/HTTP/SQLite cleanly, and exits within a documented deadline.
- [ ] The container runs as a non-root user with a read-only application filesystem and only the required persistent data mount.
- [ ] Compose has a working health check, restart policy, persistent database volume, and no unnecessary exposed service.
- [ ] Documentation covers Discord application creation, Message Content intent, minimum permissions, environment defaults, admin commands, modes, evidence review, backups, and upgrades.
- [ ] A manual development-guild smoke test covers status, dry-run, known SHA, flood, delete, enforce, safe correction, and health.
- [ ] Restart behavior and known initial-release exclusions are explicit.
- [ ] Full tests, type-checking, Biome, Compose validation, container health, and smoke documentation checks pass.
