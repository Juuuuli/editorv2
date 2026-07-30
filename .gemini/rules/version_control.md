---
description: Ensure all code modifications are automatically committed to Git to maintain a complete version history.
---

# Git Version Control Rule

- **Automatic Commits**: Whenever you (the AI) successfully complete a task that involves modifying, adding, or deleting source code files, you MUST automatically commit these changes to the Git repository.
- **Workflow**: 
  1. Complete the code modifications.
  2. Verify the changes (e.g., run `npm run build` or ensure no syntax errors).
  3. Execute `git add .` and `git commit -m "<message>"` using the terminal command tool.
- **Commit Messages**: Use the Conventional Commits format for your commit messages. Example prefixes:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `refactor:` for code refactoring
  - `style:` for formatting or UI changes
  - `docs:` for documentation updates
- **Proactiveness**: Do not ask the user for permission to commit unless the changes are massive or highly experimental. Simply commit them and inform the user that the version record has been updated.
