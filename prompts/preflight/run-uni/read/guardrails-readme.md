# Guardrails

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** The shared rules every step obeys. Read once at the start and it applies to every step afterwards.

- **You need this step when:** before any other step, in either phase.
- **How often:** every release.
- **Which assistant runs it:** either assistant (both phases).
- **How you know it worked:** `GUARDED`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/guardrails.md`
- **Step ID:** guardrails (handshake) - **Phase:** both - **Lifecycle:** every run
- **Run it when:** before any other step, in either phase.
- **Reads:** `prompts/master_system_prompt.md`, this prompt, `AGENTS.md`.
- **Writes:** nothing.
- **Pass signal:** `GUARDED`.
- **Fail signal:** `STEP_BLOCKED [<step_id>]: ...` printed by the step that violated a guardrail.
- **Notes:** A partial load is a hard stop. If the prompt returns anything other than `GUARDED`, the launcher must not schedule a step.
- **Human-only:** nothing; this is policy, not action.
