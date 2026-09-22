//! Tolkovo product layer on top of the Handy engine.
//!
//! Handy stays the engine (recording, recognition, paste, shortcuts, model
//! download). Everything Tolkovo-specific lives here so upstream merges into
//! Handy's own files stay small: `lib.rs`, `overlay.rs` and `tray.rs` only get
//! one-line hooks into this module.

use tauri::AppHandle;

use crate::settings;

/// The only recognition language Tolkovo offers.
pub const LANGUAGE: &str = "ru";

/// Enforce the product decisions from TOLKOVO.md on every start, whatever an
/// older settings file says: one language (Russian), the interface in
/// Russian, nothing that talks to the network after the model download
/// (cloud post-processing, update checks), and none of Handy's own
/// surfaces (What's New).
pub fn apply_product_settings(app: &AppHandle) {
    let mut s = settings::get_settings(app);
    let before = serde_json::to_value(&s).ok();

    s.selected_language = LANGUAGE.to_string();
    s.app_language = LANGUAGE.to_string();
    s.translate_to_english = false;
    s.post_process_enabled = false;
    s.update_checks_enabled = false;
    s.show_whats_new_on_update = false;

    if serde_json::to_value(&s).ok() != before {
        settings::write_settings(app, s);
    }
}
