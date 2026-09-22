//! Tolkovo product layer on top of the Handy engine.
//!
//! Handy stays the engine (recording, recognition, paste, shortcuts, model
//! download). Everything Tolkovo-specific lives here so upstream merges into
//! Handy's own files stay small: `lib.rs`, `overlay.rs` and `tray.rs` only get
//! one-line hooks into this module.

pub mod menu;
pub mod pill;

use tauri::AppHandle;

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
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        let _ = app.run_on_main_thread(|| unsafe {
            use objc2::msg_send;
            use objc2::runtime::{AnyClass, AnyObject, Bool};
            if let Some(cls) = AnyClass::get(c"NSApplication") {
                let nsapp: *mut AnyObject = msg_send![cls, sharedApplication];
                if !nsapp.is_null() {
                    let _: () = msg_send![&*nsapp, activateIgnoringOtherApps: Bool::YES];
                }
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
