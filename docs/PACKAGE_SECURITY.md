---
title: Security package
description: Public API, validation rules, generation, redirect behavior, consumers, and verification for packages/security.
---

# Security package

`packages/security` (`@scs/security`) owns the small security-policy contract
shared by independently deployed HTTP applications. It currently implements
only RFC 9116 `security.txt`; authentication, authorization, headers, secrets,
and incident data remain in their owning applications and services.

Use the [Security package internals](PACKAGES/SECURITY/INDEX.md) guide for its
public API, validation boundary, redirect contract, consumers, and checks.
