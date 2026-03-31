# InterCode Broker — Agent Protocol

This project uses the **InterCode Multi-Agent Broker** to coordinate work across multiple AI agents and IDE sessions. Every agent working in this codebase MUST follow the rules below.

---

## On Every Session Start

1. **Always call `get_orientation` first.** No exceptions. Read the project context and active queue.
2. **Check for blockers.** Always call `read_memos` (even without parameters) to see if another agent left a blocker or warning that you need to resolve before starting work.

Then call `start_session` to register yourself as active:

```
start_session(agent_name="<YourName>", goal="<what you are about to do>")
```

---

## Before Starting Any Work

**Always call `check_failures`** before attempting any approach you're not 100% certain about:

```
check_failures(query="<approach you're considering>")
```

If a match comes back, read it. Don't repeat dead-end approaches.

---

## While Working

### When you get blocked or need another agent
If you encounter a missing dependency, missing credentials, or a codebase issue you can't solve, DO NOT JUST STOP. Call `leave_memo`:

```
leave_memo(
  agent_name="<YourName>",
  urgency="blocker",
  message="I cannot finish the auth flow because the NEXT_PUBLIC_AUTH0_CLIENT_ID environment variable is missing. Someone needs to add it."
)
```

### When you finish a meaningful step
Call `log_progress` after every significant action — finishing a function, fixing a bug, completing a refactor:

```
log_progress(agent_name="<YourName>", summary="Implemented JWT refresh token rotation in auth.ts")
```

### When you make a non-obvious technical decision
Call `log_decision` to persist it for all other agents:

```
log_decision(
  agent_name="<YourName>",
  key="jwt-refresh-strategy",
  decision="Using sliding window refresh tokens stored in httpOnly cookies",
  rationale="Prevents XSS token theft while supporting long sessions"
)
```

### When you discover out-of-scope work
Don't do it yourself. Add it to the board instead:

```
add_task(
  agent_name="<YourName>",
  title="Add rate limiting to /api/auth/login",
  reasoning="Noticed brute force vulnerability while implementing auth"
)
```

### When you produce a file another agent may need to reference
Register it as an artifact:

```
register_artifact(
  agent_name="<YourName>",
  name="Auth Module",
  path="src/auth/index.ts",
  description="Handles login, logout, token refresh. Entry point for all auth flows."
)
```

### When an approach completely fails
Log it so no other agent wastes time:

```
log_failure(
  agent_name="<YourName>",
  approach="Using passport.js for OAuth2",
  reason="Does not support our custom session store without major monkey-patching"
)
```

---

## Claiming Tasks

When picking up a task from the board, always claim it atomically to prevent conflicts:

```
claim_task(task_id=<id>, agent_name="<YourName>")
```

Update it as you progress:

```
update_task(task_id=<id>, status="done", agent_name="<YourName>", notes="Completed in src/auth/")
```

---

## On Session End

Always end your session before finishing your turn on a ticket:

```
end_session(agent_name="<YourName>", status="completed")
```

---

## Memory: When to Store vs Log

| Situation | Tool |
|---|---|
| Architectural decision made | `log_decision` |
| General knowledge or rule discovered | `store_memory` |
| Step completed during current task | `log_progress` |
| Approach hit a dead end | `log_failure` |
| File produced that others need | `register_artifact` |
| Blocked and need help from the user or next agent | `leave_memo` |
| Discovered a new bug that needs fixing later | `add_task` |

---

## Agent Names

Use your IDE identifier as your agent name:
- Antigravity → `"Antigravity"`
- Cursor → `"Cursor"`
- Windsurf → `"Windsurf"`
- Claude → `"Claude"`
