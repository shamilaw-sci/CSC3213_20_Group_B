# Security Policy

Security reports for the **SCS PDN Monorepo** are handled privately by the project maintainers. This repository contains the websites and services developed for the Department of Statistics and Computer Science, University of Peradeniya.

## Supported Versions

Security fixes are evaluated against the currently maintained source on the default (`main`) branch and the corresponding active deployments. Applications and services are deployed independently, so their deployed revisions may differ.

| Version or deployment                                       | Security support                        |
| ----------------------------------------------------------- | --------------------------------------- |
| Current `main` branch and actively maintained deployments   | Supported for security review and fixes |
| Older commits, feature branches, and superseded deployments | Not routinely supported                 |
| Forks, unofficial deployments, and locally modified copies  | Not maintained by this project          |

This is not a guarantee of a particular response time or fix timeline. The team will assess reports based on severity, impact, reproducibility, and available maintainers.

## Reporting a Vulnerability

**Do not disclose suspected vulnerabilities in public GitHub issues, pull requests, discussions, or other public channels.**

Report vulnerabilities privately by emailing **[s21513@sci.pdn.ac.lk](mailto:s21513@sci.pdn.ac.lk)**.

- Reporting guidance: <https://portal.scs-pdn.space/privacy#security-reporting>
- Machine-readable security contact: <https://portal.scs-pdn.space/.well-known/security.txt>

Include, where possible:

1. The affected application, service, endpoint, or repository component.
2. A concise description of the weakness and potential impact.
3. Reproduction steps or a minimal proof of concept that does not expose real user data.
4. Relevant versions, deployed URLs, or commit SHAs, if known.
5. A safe way to contact you for clarification.

Never email real passwords, session cookies, access tokens, private keys, or copies of private user records. Contact the maintainers first if sensitive evidence is needed.

## Scope

Relevant components include:

- **Public applications:** `apps/web`, `apps/people`, `apps/projects`, and their public content and data-consumption paths.
- **Authenticated application:** `apps/portal`, including account access and management workflows.
- **Documentation:** `apps/docs` and its published handbook content.
- **API and authentication:** `services/api`, including Better Auth, sessions, authorization, and Cloudflare D1-backed state.
- **Automation:** `services/github-app`, including authenticated service calls and Git-backed updates.
- **Email:** `services/mailer`, including service authentication and outbound email handling.
- **Shared packages and deployment configuration:** security-sensitive contracts, validators, CI workflows, and infrastructure configuration maintained in this repository.

The public-data repository and third-party providers have separate ownership or operational boundaries. Reports involving their integration with this project are welcome; issues confined entirely to an external system should also be reported to its responsible operator.

## Responsible Disclosure

Please:

- Test only accounts, data, and systems you own or are expressly authorized to use.
- Avoid destructive testing, denial-of-service activity, bulk scanning, credential attacks, and attempts to access or modify other users' information.
- Stop testing if you encounter confidential data; do not retain, redistribute, or publish it.
- Give maintainers a reasonable opportunity to investigate and coordinate remediation before public disclosure.
- Do not publish proof-of-concept exploits or sensitive implementation details before coordination.

No authorization to test university or third-party infrastructure is granted by this policy. No bug bounty, financial reward, or legal safe-harbor commitment is offered by this document.

## Handling Reports

Maintainers aim to assess reports privately, establish affected components and deployments, contain risks where necessary, and prepare and verify a fix. Depending on the issue, remediation may involve application code, dependency updates, access-control changes, credential rotation, database migrations, or changes to external provider configuration.

Acknowledgment, remediation, and disclosure schedules are not guaranteed. Public advisories or release notes may be issued when appropriate after affected systems are protected.

## Security Documentation

For implementation and maintainer guidance, see:

- [Security architecture and response](docs/SECURITY.md)
- [Authentication and authorization](docs/AUTHENTICATION.md)
- [Operational procedures](docs/OPERATIONS.md)
- [Dependency management](docs/DEPENDENCY_MANAGEMENT.md)

This file defines **how to report a vulnerability**. The linked guides describe project-specific technical and operational controls and are not substitutes for private reporting.
