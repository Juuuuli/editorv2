---
description: Always commit changes to git after modifying files
---

# Git Commit Policy

Whenever you make any modifications to the codebase (such as adding, editing, or deleting files), you MUST:
1. Stage all changes using `git add .`
2. Commit the changes using `git commit -m "<descriptive message>"`
3. If necessary, push the changes.
4. Inform the user that the changes have been committed.

This rule ensures that the user's workspace history is preserved and any experimental changes can be safely reverted or tracked.
