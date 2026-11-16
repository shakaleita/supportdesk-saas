# HTTP interface

Main operations:

- `GET/POST /api/agents`
- `GET/POST /api/tickets`
- `PATCH /api/tickets/:id`
- `GET/POST /api/tickets/:id/notes`

Additional read-only endpoints:

- `GET /api/insights` — aggregated product metrics
- `GET /api/health` — dependency/availability probe

These endpoints are demonstration APIs; no public authentication is implemented. See source and tests for payload fields and status codes.
