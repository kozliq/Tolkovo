//! Tolkovo product layer on top of the Handy engine.
//!
//! Handy stays the engine (recording, recognition, paste, shortcuts, model
//! download). Everything Tolkovo-specific lives here so upstream merges into
//! Handy's own files stay small: `lib.rs`, `overlay.rs` and `tray.rs` only get
//! one-line hooks into this module.

pub mod dictionary;
pub mod menu;
pub mod pill;
pub mod stats;

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::settings::{self, OverlayStyle};

/// The only recognition language Tolkovo offers.
pub const LANGUAGE: &str = "ru";

/// Enforce the product decisions from TOLKOVO.md on every start, whatever an
/// older settings file says: one language (Russian), the interface in
/// Russian, nothing that talks to the network after the model download
/// (cloud post-processing, update checks), and none of Handy's own
/// surfaces (What's New, Handy's recording overlay — the pill replaces it).
/// The app lives in the menu bar and starts without a window.
pub fn apply_product_settings(app: &AppHandle) {
    let mut s = settings::get_settings(app);
    let before = serde_json::to_value(&s).ok();

    s.selected_language = LANGUAGE.to_string();
    s.app_language = LANGUAGE.to_string();
    s.translate_to_english = false;
    s.post_process_enabled = false;
    s.update_checks_enabled = false;
    s.show_whats_new_on_update = false;
    s.overlay_style = OverlayStyle::None;
    // Lives in the menu bar: the window appears only on the first run and
    // when the user asks for it (menu → Настройки).
    s.start_hidden = true;
    s.show_tray_icon = true;

    if serde_json::to_value(&s).ok() != before {
        settings::write_settings(app, s);
    }
}

/// Create Tolkovo's own surfaces. Called from `lib.rs` after the engine is up.
pub fn init(app: &AppHandle) {
    pill::create(app);
    // The app starts hidden (see apply_product_settings); the first run is
    // the one time the window opens by itself.
    let s = settings::get_settings(app);
    if !s.onboarding_completed || s.selected_model.is_empty() {
        crate::show_main_window(app);
    }
}

/// Bring the settings window forward without a Dock icon. Handy promotes the
/// app to a regular (Dock) app whenever the window shows; Tolkovo stays a
/// menu-bar app and just activates, so the window gets focus.
pub fn focus_without_dock(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || unsafe {
            use objc2::msg_send;
            use objc2::runtime::{AnyClass, AnyObject, Bool};

            // Bring the window onto the Space the user is on — including a
            // full-screen app's Space — even if macOS declines to activate
            // us (macOS 14+ activation is cooperative).
            if let Some(w) = handle.get_webview_window("main") {
                if let Ok(ptr) = w.ns_window() {
                    let ns_window = ptr as *mut AnyObject;
                    if !ns_window.is_null() {
                        const MOVE_TO_ACTIVE_SPACE: usize = 1 << 1;
                        const FULL_SCREEN_AUXILIARY: usize = 1 << 8;
                        let current: usize = msg_send![&*ns_window, collectionBehavior];
                        let wanted = current | MOVE_TO_ACTIVE_SPACE | FULL_SCREEN_AUXILIARY;
                        let _: () = msg_send![&*ns_window, setCollectionBehavior: wanted];
                        // A window still ordered in on another Space stays
                        // there; ordering it out and back in places it on
                        // the active Space.
                        let none: *const AnyObject = std::ptr::null();
                        let _: () = msg_send![&*ns_window, orderOut: none];
                        let _: () = msg_send![&*ns_window, orderFrontRegardless];
                    }
                }
            }
            if let Some(cls) = AnyClass::get(c"NSApplication") {
                let nsapp: *mut AnyObject = msg_send![cls, sharedApplication];
                if !nsapp.is_null() {
                    let _: () = msg_send![&*nsapp, activateIgnoringOtherApps: Bool::YES];
                }
            }
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.set_focus();
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

/// Re-evaluate what Tolkovo shows after the first run finishes.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_onboarding_finished(app: AppHandle) {
    pill::refresh_visibility(&app);
}

// ---------- Output polish ----------

const STORE_PATH: &str = "tolkovo.json";
const KEY_TRAILING_PERIOD: &str = "trailing_period";

/// Whether the dictation keeps its final period ("Точка в конце"). On by
/// default; chats often read better without it.
fn trailing_period(app: &AppHandle) -> bool {
    app.store(crate::portable::store_path(STORE_PATH))
        .ok()
        .and_then(|s| s.get(KEY_TRAILING_PERIOD))
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

/// Drop one final period. "...", "…", "?" and "!" stay; trailing spaces
/// (Handy's "append trailing space") are kept after the cut.
fn without_final_period(text: &str) -> String {
    let body = text.trim_end();
    let tail = &text[body.len()..];
    match body.strip_suffix('.') {
        Some(rest) if !rest.ends_with('.') => format!("{rest}{tail}"),
        _ => text.to_string(),
    }
}

/// Everything Tolkovo does to the recognized text before it is pasted:
/// the personal dictionary, then the final period.
pub fn polish(app: &AppHandle, text: &str) -> String {
    let text = dictionary::apply(app, text);
    if trailing_period(app) {
        text
    } else {
        without_final_period(&text)
    }
}

#[tauri::command]
#[specta::specta]
pub fn tolkovo_get_trailing_period(app: AppHandle) -> bool {
    trailing_period(&app)
}

#[tauri::command]
#[specta::specta]
pub fn tolkovo_set_trailing_period(app: AppHandle, enabled: bool) -> Result<(), String> {
    app.store(crate::portable::store_path(STORE_PATH))
        .map_err(|e| e.to_string())?
        .set(KEY_TRAILING_PERIOD, serde_json::json!(enabled));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::without_final_period as cut;

    #[test]
    fn drops_only_one_final_period() {
        assert_eq!(cut("Привет, как дела."), "Привет, как дела");
        assert_eq!(cut("Ок. Понял. "), "Ок. Понял ");
        assert_eq!(cut("Ну и ну..."), "Ну и ну...");
        assert_eq!(cut("Правда?"), "Правда?");
        assert_eq!(cut("Ура!"), "Ура!");
        assert_eq!(cut("Ждём…"), "Ждём…");
        assert_eq!(cut(""), "");
    }
}
