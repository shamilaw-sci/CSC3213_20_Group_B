---
title: Repository handbook
description: Start here to understand, develop, verify, deploy, and operate the SCS PDN monorepo.
---

# Repository handbook

This handbook is the source of truth for the applications, services, shared
packages, contracts, and operating practices in this repository. The same
Markdown files are readable on GitHub and published by the documentation site.

## Choose a path

- New contributors should start with [Development](DEVELOPMENT.md), then read
  [Architecture](ARCHITECTURE.md).
- Application and service maintainers should use
  [API contracts](API_CONTRACTS.md), [Schemas](SCHEMAS.md), and
  [Environment variables](ENVIRONMENT_VARIABLES.md).
- Release and incident work starts in [CI](CI.md),
  [Operations](OPERATIONS.md),
  [Departmental deployment](DEPARTMENTAL_DEPLOYMENT.md),
  [Staging acceptance](STAGING_ACCEPTANCE.md), and [Security](SECURITY.md).
- Interface changes should follow
  [UI quality assurance](UI_QUALITY_ASSURANCE.md).
- Browser agent tools are documented in [Browser WebMCP](WEBMCP.md).

## Browse the handbook

- System design: [Authentication](AUTHENTICATION.md),
  [Public data](PUBLIC_DATA.md),
  [Public data repository](PUBLIC_DATA_REPOSITORY.md),
  [API contracts](API_CONTRACTS.md),
  [Schemas](SCHEMAS.md), and [UI system](UI_SYSTEM.md).
- Applications: [Web](APPLICATION_WEB.md), [People](APPLICATION_PEOPLE.md),
  [Projects](APPLICATION_PROJECTS.md), and [Portal](APPLICATION_PORTAL.md).
- Services: start with [Service internals](SERVICES/INDEX.md), then use the
  concise [API](SERVICE_API.md), [GitHub App](SERVICE_GITHUB_APP.md), and
  [Mailer](SERVICE_MAILER.md) entry points.
- Shared packages: use the [package guide](PACKAGES/INDEX.md) for every package;
  [Identity](PACKAGE_IDENTITY.md), [Schemas](PACKAGE_SCHEMAS.md),
  [Security](PACKAGE_SECURITY.md), [UI](PACKAGE_UI.md),
  [TypeScript](PACKAGE_TSCONFIG.md), and [ESLint](PACKAGE_ESLINT_CONFIG.md)
  have focused overviews.
- Working practices: [Testing](TESTING.md),
  [Performance testing](PERFORMANCE_TESTING.md),
  [Dependency management](DEPENDENCY_MANAGEMENT.md),
  [AI agent skills](AI_AGENT_SKILLS.md),
  [Documentation authoring](DOCUMENTATION_AUTHORING.md), and
  [Troubleshooting](TROUBLESHOOTING.md).
- Reference: [Route reference](ROUTE_REFERENCE.md) and
  [Glossary](GLOSSARY.md).
