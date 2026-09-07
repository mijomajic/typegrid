# Security

Do not post credentials or personal telemetry in public issues. Report vulnerabilities through GitHub’s private vulnerability reporting feature when enabled on this repository, or contact the maintainer through their GitHub profile to arrange a private report.

Include reproduction steps against a disposable local instance, expected/actual authorization behavior, and the affected version. Never test destructive or high-volume behavior against the public service.

The native agent has Input Monitoring permission, so supply-chain review matters. Version 0.1.0 is built from auditable source on the user’s machine. Release assets are checksum-verified but not notarized or signed with a developer identity.
