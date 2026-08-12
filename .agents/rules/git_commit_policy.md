---
description: Always commit changes to git after modifying files
---

# Git Commit Policy

Whenever you make any modifications to the codebase (such as adding, editing, or deleting files), you MUST:
1. Stage all changes using `git add .`
2. Commit the changes using `git commit -m "<descriptive message>"`
3. ALWAYS push the changes to the remote repository using `git push`. This ensures GitHub Actions and remote deployments are triggered.
4. Inform the user that the changes have been committed and pushed.

This rule ensures that the user's workspace history is preserved and any experimental changes can be safely reverted or tracked.
