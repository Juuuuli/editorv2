---
name: save-progress
description: >-
  Use this skill when the user asks to "記錄存檔" or "save progress". This skill creates a comprehensive handover markdown file for the next agent to understand the project's current state, rules, directory structure, and development progress.
---

# Save Progress (記錄存檔) Skill

When the user asks you to "記錄存檔" (save progress), you must execute the following steps to create a comprehensive handover document for the next AI agent.

## Steps

1. **Find Previous Progress File**:
   - Check the `C:\EditorV2\progress_reviews\` directory for the most recent progress markdown file.
   - Read its content. Your new file must incorporate or build upon this previous progress.

2. **Generate Directory Structure**:
   - Run a command (e.g. using `tree /A /F` in PowerShell) to get the detailed directory structure of the `C:\EditorV2` project, ensuring you output a comprehensive depth so the next agent sees all important folders and files in `src`, `docs`, etc. (You can exclude `node_modules`, `dist`, `.git`).
   - Identify any recently added or modified files since the last progress save.

3. **Determine Current Status**:
   - Read `C:\EditorV2\系統升級計畫書.md` or `C:\EditorV2\系統升級計畫書.html` to determine the current Sprint phase, what has been completed, and what is currently WIP.

4. **Create the New Progress File**:
   - Create a new file in `C:\EditorV2\progress_reviews\` named `YYYY-MM-DD-progress.md` (using today's date).
   - If a file for today already exists, append a version number (e.g., `YYYY-MM-DD-v2-progress.md`).
   - Write the following exact sections in the file:

### Template for the New Progress File

```markdown
# 專案進度交接文檔 (Project Handover)

> **給下一個 Agent 的重要指示 (Read Me First):**
> 1. 請務必優先讀取並嚴格遵守 `C:\EditorV2\.agents\rules` 裡面的所有內容。
> 2. 為了了解專案背景與規範，請讀取 `C:\EditorV2\docs` 裡面的所有功能規格書，以及專案的需求藍圖。

## 1. 目前開發階段與計畫 (Current Phase)
- **整體計畫進度**: (根據計畫書描述目前的 Sprint 與階段目標。如果有特別需要讀取的計畫書，請在此標明，例如：請先閱讀 `C:\EditorV2\系統升級計畫書.md`)
- **已完成事項**: (列出已開發完成的核心模組)
- **正在進行中 (WIP)**: (描述目前正在開發的項目)
- **最新工作路徑 (Latest Work)**: (請特別標出剛完成或正在修改的核心檔案路徑，例如 `C:\EditorV2\src\...`，以指引下一個 Agent 直接讀取)

## 2. 專案資料夾結構 (Directory Structure)
(在此貼上目前的資料夾結構)
- **新增/修改檔案標註**: (特別列出本次存檔前新增或大幅修改的檔案)

## 3. 前次進度繼承 (Previous Context)
(將前一份進度檔案的核心備註、未解問題或重要決策保留在此，確保上下文不會斷層)
```

5. **Notify the User**:
   - After the file is successfully created, output a message to the user confirming that the progress has been saved, and provide a clickable link to the newly created markdown file.
