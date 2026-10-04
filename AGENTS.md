# Ventro agent instructions

## gstack

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted engineering workflows. Before starting work, verify that gstack is available at `~/.codex/skills/gstack` or `~/.gstack/repos/gstack`.

Use the matching gstack skill whenever the request fits one:

- Product discovery and shaping: `/gstack-office-hours`, `/gstack-plan-ceo-review`
- Architecture and implementation planning: `/gstack-plan-eng-review`, `/gstack-autoplan`
- Bugs and diagnosis: `/gstack-investigate`
- Code review and quality: `/gstack-review`, `/gstack-health`, `/gstack-test-audit`
- Browser testing and QA: `/gstack-browse`, `/gstack-qa`, `/gstack-qa-only`
- Security: `/gstack-cso`
- Documentation: `/gstack-document-generate`, `/gstack-document-release`
- Shipping and deployment: `/gstack-ship`, `/gstack-land-and-deploy`

If the skills are missing, run:

```bash
cd ~/.gstack/repos/gstack
./setup --host codex --team
```

Follow gstack's core rules: investigate root causes before fixing symptoms, search for existing project patterns before adding code, cover relevant tests and error paths, and keep unrelated cleanup outside the requested scope.

## Health Stack

- typecheck: npm run typecheck
- lint: npm run lint
- test: npm test
