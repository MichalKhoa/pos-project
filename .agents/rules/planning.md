# Planning, Follow-Up Inquiries & Next Plan Rules — Himmel POS

This document defines mandatory planning protocols, interactive inquiry standards, and next-plan proposal formats for Himmel POS.

---

## 1. Implementation Planning Discipline

- **Mandatory Plan**: Create `implementation_plan.md` before making multi-file modifications or executing non-trivial feature tasks.
- **Phased Subtask Breakdown**: Complex tasks MUST be partitioned into sequential, numbered phases (Phase 1, Phase 2, Phase 3...) to keep edits surgical and verifiable.
- **User Approval First**: Obtain explicit user approval on the implementation plan before beginning code edits.

---

## 2. Mandatory Follow-Up Questions

At the conclusion of every response, milestone, or completed task:
- **Targeted Questions**: Ask 1–3 specific questions regarding edge cases, user preferences, security/fiscal considerations, or testing scope.
- **Avoid Generic Fluff**: Do not ask open-ended questions like "Is there anything else?". Focus on technical decisions, potential tradeoffs, or next-step priorities.

---

## 3. Next Plan Options Template

Every completed response or task MUST conclude with concrete, structured next steps:
- **Provide 2–3 Clear Options**: Present actionable choices formatted with bold option headers and brief impact descriptions.
- **Recommended Action**: Highlight the primary recommended option when obvious.

### Format Pattern

```markdown
### Follow-Up Questions
1. [Targeted question on edge case / preference / risk]
2. [Targeted question on verification / deployment / configuration]

### Next Plan Options
- **Option 1 (Recommended)**: [Actionable immediate next step]
- **Option 2**: [Alternative or subsequent phase]
- **Option 3**: [Testing, verification, or cleanup path]
```
