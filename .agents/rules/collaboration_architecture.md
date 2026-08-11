# Collaboration Architecture Rules

This rule file defines the architecture and constraints for the EditorV2 Real-time Collaboration Engine (Sprint 5, v2.0.0).

## 1. Yjs as the Single Source of Truth
- **Rule**: All canvas state MUST be stored in Yjs structures (`Y.Doc`, `Y.Map`, `Y.Array`) for collaborative sessions.
- **Rule**: Do not rely on Fabric.js as the primary state store when connected. Any changes made to the Fabric canvas MUST be pushed to Yjs.
- **Rule**: Incoming changes from Yjs must update the Fabric canvas without triggering a recursive loop back to Yjs. (Use flags like `isSyncing` to prevent echo loops).

## 2. WebRTC & Awareness
- **Rule**: Use `y-webrtc` for network transport and awareness.
- **Rule**: Cursor positions and selection lock (Object Lease) MUST be broadcasted using the Yjs Awareness protocol.
- **Rule**: Do not broadcast heavy canvas JSON via `BroadcastChannel` or raw `PeerJS` data connections once Yjs is active. Let Yjs handle the diff synchronization.

## 3. UI and UX Constraints
- **Rule**: When an object is locked by another user (via Awareness selection), the object must be unselectable (`selectable: false`) and visually indicate the owner's presence (e.g., colored stroke or bounding box).
- **Rule**: Remote cursors should use LERP (Linear Interpolation) to appear smooth. Do not snap cursors directly to the newest coordinate without smoothing, as network jitter will cause visual stuttering.

## 4. Module Boundaries
- `CollabEngine.js`: Manages the Y.Doc lifecycle and y-webrtc provider.
- `YjsAdapter.js`: Pure logic for syncing Fabric.js <-> Yjs.
- `MultiplayerCursorOverlay.js`: Pure UI logic for rendering cursors on top of the canvas.
- `ObjectLeaseManager.js`: Handles locking and unlocking of Fabric objects based on Awareness state.
