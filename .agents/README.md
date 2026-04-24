# `.agents/`

This directory hosts [Agent Skills](https://agentskills.io) for the
Airfoil TypeScript SDK. Skills provide AI coding agents with focused,
progressively-disclosed playbooks for specific, repeatable tasks against
this codebase.

## Available skills

- [`skills/build-connector/`](./skills/build-connector/) — end-to-end playbook
  for implementing a new Airfoil producer connector from scratch using the
  `templates/producer-template/` scaffold, with docs-first API research and
  deterministic validation gates.

## Directory layout

Each skill follows the standard layout:

```
.agents/skills/<skill-name>/
├── SKILL.md           # lean orchestrator (YAML frontmatter + body)
├── references/        # deep docs (tier-3, loaded on demand)
└── assets/            # copy-paste templates and checklists
```

`SKILL.md` is the entry point. Its frontmatter (`name`, `description`) is
what agent hosts index on, and the body points at the detailed files under
`references/` and `assets/`.

## Where is this referenced?

- [`AGENTS.md`](../AGENTS.md) at the repo root has a short pointer section.
- Editor-agent tooling (Claude, Cursor, Codex, OpenCode, etc.) reads the
  YAML frontmatter of each `SKILL.md` to decide when to activate the skill.
