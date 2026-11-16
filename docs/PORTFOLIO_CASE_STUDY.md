# SupportDesk SaaS — Engineering Case Study & Quality Roadmap

**Portfolio:** [Digital Solution9](https://github.com/shakaleita/teamforge-saas/blob/main/PORTFOLIO.md) · **Repository:** [Source](https://github.com/shakaleita/supportdesk-saas)  
**Stack:** Node.js, Express, SQLite · **Status:** Local portfolio MVP; not certified production software.

## Implemented domain workflow
Support ticket intake, categorization, assignment, priority filters and internal notes.

## Domain invariants
Internal notes must not appear in public customer views; ticket assignment requires valid agents; case transitions must be audited.

## Verification backlog (not yet proven)
- Authorization denies unauthorized access to internal notes
- Ticket transitions and assignments reject invalid identifiers
- Concurrent updates preserve notes and final state

## High-value engineering upgrades
1. Implement customer/agent/admin roles
2. Add SLA clock and escalation queue with deterministic time controls
3. Add event audit trail, API and accessibility tests

## Production release gate

Verify authentication and authorization, concurrency and rollback scenarios, schema migrations, CI and browser tests, backup/restore, synthetic-data staging deployment, accessibility, security review, and reproducible performance measurements. The current README describes a local MVP and should remain honest until this evidence is available.

**Scope:** The improvement list is a plan; it does not claim implementations or tests already exist.
