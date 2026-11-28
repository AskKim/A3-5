# Guardrails - Step Readme

- **Prompt:** `prompts/preflight/run-uni/guardrails.md`
- **Step ID:** guardrails (handshake) - **Phase:** both - **Lifecycle:** every run
- **Run it when:** before any other step, in either phase.
- **Reads:** `prompts/master_system_prompt.md`, this prompt, `AGENTS.md`.
- **Writes:** nothing.
- **Pass signal:** `GUARDED`.
- **Fail signal:** `STEP_BLOCKED [<step_id>]: ...` printed by the step that violated a guardrail.
- **Notes:** A partial load is a hard stop. If the prompt returns anything other than `GUARDED`, the launcher must not schedule a step.
- **Human-only:** nothing; this is policy, not action.
