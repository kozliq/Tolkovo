//! The pill: Tolkovo's only always-visible surface.
//!
//! A small floating glass capsule (see design/States.dc.html). It lives in
//! its own non-activating panel, above every window, on every Space and over
//! full-screen apps, and never takes focus. It fills with burgundy while
//! recording and drains when recording stops. The user can drag it anywhere
//! (the position is remembered) and click it to start/stop recording.
//!
//! The engine drives it through one hook in Handy's `tray.rs`
//! (`on_engine_state`); Handy's own recording overlay is disabled.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};
use tauri_plugin_store::StoreExt;

use crate::settings;
use crate::tray::TrayIconState;

pub const PILL_LABEL: &str = "tolkovo_pill";

/// Visible capsule size (logical points), per TOLKOVO.md / States mockup.
const PILL_WIDTH: f64 = 64.0;
const PILL_HEIGHT: f64 = 140.0;
/// Transparent margin around the capsule so its drop shadow isn't clipped.
const PILL_MARGIN: f64 = 24.0;
const WINDOW_WIDTH: f64 = PILL_WIDTH + PILL_MARGIN * 2.0;
const WINDOW_HEIGHT: f64 = PILL_HEIGHT + PILL_MARGIN * 2.0;

/// How long the drain animation runs before a "when recording" pill hides.
const DRAIN_MS: u64 = 700;

const STORE_PATH: &str = "tolkovo.json";
const KEY_POSITION: &str = "pill_position";
const KEY_MODE: &str = "pill_mode";

/// When the pill is on screen.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case")]
pub enum PillMode {
    /// Always on screen (default).
    Always,
    /// Only while recording and transcribing.
    WhileRecording,
}

/// What the pill shows. Sent to the pill webview as `tk-pill-state`.
#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum PillState {
    /// Empty glass.
    Idle,
    /// Filled to the brim.
    Recording,
    /// Liquid drains down while the text is recognized and pasted.
    Draining,
}

static CURRENT: Mutex<PillState> = Mutex::new(PillState::Idle);
/// Bumped on every state change so a delayed hide can tell it is stale.
static GENERATION: AtomicU64 = AtomicU64::new(0);
/// Bumped on every window move; the position is saved once moves settle.
static MOVE_GENERATION: AtomicU64 = AtomicU64::new(0);

fn store_path() -> std::path::PathBuf {
    crate::portable::store_path(STORE_PATH)
}

pub fn get_mode(app: &AppHandle) -> PillMode {
    app.store(store_path())
        .ok()
        .and_then(|s| s.get(KEY_MODE))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or(PillMode::Always)
}

fn save_mode(app: &AppHandle, mode: PillMode) {
    if let Ok(store) = app.store(store_path()) {
        store.set(KEY_MODE, serde_json::json!(mode));
    }
}

fn saved_position(app: &AppHandle) -> Option<(f64, f64)> {
    let value = app.store(store_path()).ok()?.get(KEY_POSITION)?;
    Some((value.get("x")?.as_f64()?, value.get("y")?.as_f64()?))
}

fn save_position(app: &AppHandle, x: f64, y: f64) {
    if let Ok(store) = app.store(store_path()) {
        store.set(KEY_POSITION, serde_json::json!({ "x": x, "y": y }));
    }
}

/// Logical bounds (x, y, w, h) of every monitor.
fn monitor_bounds(app: &AppHandle) -> Vec<(f64, f64, f64, f64)> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let s = m.scale_factor();
            (
                m.position().x as f64 / s,
                m.position().y as f64 / s,
                m.size().width as f64 / s,
                m.size().height as f64 / s,
            )
        })
        .collect()
}

/// The remembered position if it is still on some screen (monitors come and
/// go), otherwise the right edge of the main screen, vertically centered —
/// where the Live mockup puts it.
fn initial_position(app: &AppHandle) -> (f64, f64) {
    let monitors = monitor_bounds(app);
    if let Some((x, y)) = saved_position(app) {
        let cx = x + WINDOW_WIDTH / 2.0;
        let cy = y + WINDOW_HEIGHT / 2.0;
        if monitors
            .iter()
            .any(|&(mx, my, mw, mh)| cx >= mx && cx < mx + mw && cy >= my && cy < my + mh)
        {
            return (x, y);
        }
    }
    let (mx, my, mw, mh) = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let s = m.scale_factor();
            (
                m.position().x as f64 / s,
                m.position().y as f64 / s,
                m.size().width as f64 / s,
                m.size().height as f64 / s,
            )
        })
        .or_else(|| monitors.first().copied())
        .unwrap_or((0.0, 0.0, 1440.0, 900.0));
    (
        mx + mw - WINDOW_WIDTH - 24.0,
        my + (mh - WINDOW_HEIGHT) / 2.0,
    )
}

/// Whether the first run is finished (the pill stays hidden until then).
fn onboarded(app: &AppHandle) -> bool {
    let s = settings::get_settings(app);
    s.onboarding_completed && !s.selected_model.is_empty()
}

#[cfg(target_os = "macos")]
mod panel {
    #[allow(unused_imports)]
    use tauri::Manager;
    use tauri_nspanel::tauri_panel;
    tauri_panel! {
        panel!(TolkovoPillPanel {
            config: {
                can_become_key_window: false,
                is_floating_panel: true
            }
        })
    }
}

/// Create the pill window (hidden). Called once at startup.
pub fn create(app: &AppHandle) {
    let (x, y) = initial_position(app);
    let url = WebviewUrl::App("src/pill/index.html".into());

    #[cfg(target_os = "macos")]
    let window = {
        use tauri_nspanel::{CollectionBehavior, PanelBuilder, PanelLevel, StyleMask};
        match PanelBuilder::<_, panel::TolkovoPillPanel>::new(app, PILL_LABEL)
            .url(url)
            .title("Tolkovo")
            .position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
            .size(tauri::Size::Logical(tauri::LogicalSize {
                width: WINDOW_WIDTH,
                height: WINDOW_HEIGHT,
            }))
            .level(PanelLevel::Status)
            .has_shadow(false)
            .transparent(true)
            .no_activate(true)
            .corner_radius(0.0)
            .style_mask(StyleMask::empty().borderless().nonactivating_panel())
            .with_window(|w| {
                w.decorations(false)
                    .transparent(true)
                    .focusable(false)
                    .accept_first_mouse(true)
                    .skip_taskbar(true)
            })
            .collection_behavior(
                CollectionBehavior::new()
                    .can_join_all_spaces()
                    .full_screen_auxiliary()
                    .stationary(),
            )
            .build()
        {
            Ok(panel) => {
                panel.hide();
                app.get_webview_window(PILL_LABEL)
            }
            Err(e) => {
                log::error!("Failed to create the pill panel: {e}");
                None
            }
        }
    };

    #[cfg(not(target_os = "macos"))]
    let window = {
        let mut builder = tauri::WebviewWindowBuilder::new(app, PILL_LABEL, url)
            .title("Tolkovo")
            .position(x, y)
            .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .visible_on_all_workspaces(true)
            .skip_taskbar(true)
            .focusable(false)
            .focused(false)
            .accept_first_mouse(true)
            .visible(false);
        if let Some(data_dir) = crate::portable::data_dir() {
            builder = builder.data_directory(data_dir.join("webview"));
        }
        builder
            .build()
            .map_err(|e| log::error!("Failed to create the pill window: {e}"))
            .ok()
    };

    if let Some(window) = window {
        let handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Moved(_) = event {
                remember_position_soon(&handle);
            }
        });
    }

    refresh_visibility(app);
}

/// Save the pill position once dragging settles (Moved fires continuously).
fn remember_position_soon(app: &AppHandle) {
    let generation = MOVE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(400));
        if MOVE_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        let Some(window) = app.get_webview_window(PILL_LABEL) else {
            return;
        };
        if let (Ok(pos), Ok(scale)) = (window.outer_position(), window.scale_factor()) {
            save_position(&app, pos.x as f64 / scale, pos.y as f64 / scale);
        }
    });
}

fn set_state(app: &AppHandle, state: PillState) {
    {
        let mut current = CURRENT.lock().unwrap_or_else(|e| e.into_inner());
        if *current == state {
            return;
        }
        *current = state;
    }
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let _ = app.emit_to(PILL_LABEL, "tk-pill-state", state);

    let always = get_mode(app) == PillMode::Always && onboarded(app);
    match state {
        PillState::Recording | PillState::Draining => show(app),
        PillState::Idle if always => show(app),
        PillState::Idle => {
            // Let the liquid finish draining, then hide — unless a new
            // recording started in the meantime.
            let app = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(DRAIN_MS));
                if GENERATION.load(Ordering::SeqCst) == generation {
                    hide(&app);
                }
            });
        }
    }
}

fn show(app: &AppHandle) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = app2.get_webview_window(PILL_LABEL) {
            // Re-showing a visible panel makes it blink, and WebKit skips a
            // running CSS transition when its window blinks — the drain
            // animation would jump straight to empty.
            if !w.is_visible().unwrap_or(false) {
                let _ = w.show();
            }
        }
    });
}

fn hide(app: &AppHandle) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = app2.get_webview_window(PILL_LABEL) {
            let _ = w.hide();
        }
    });
}

/// Show or hide the resting pill according to the mode and first-run state.
pub fn refresh_visibility(app: &AppHandle) {
    let idle = *CURRENT.lock().unwrap_or_else(|e| e.into_inner()) == PillState::Idle;
    if !idle {
        return;
    }
    if get_mode(app) == PillMode::Always && onboarded(app) {
        show(app);
    } else {
        hide(app);
    }
}

/// Hook from Handy's tray (`tray::set_tray_state`), which the engine updates
/// on every recording state change whatever the overlay settings are.
pub fn on_engine_state(app: &AppHandle, state: TrayIconState) {
    set_state(
        app,
        match state {
            TrayIconState::Recording => PillState::Recording,
            TrayIconState::Transcribing => PillState::Draining,
            TrayIconState::Idle => PillState::Idle,
        },
    );
}

// ---------- Commands ----------

/// Click on the pill: start or stop recording, like the hotkey.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_pill_click(app: AppHandle) {
    crate::signal_handle::send_transcription_input(&app, "transcribe", "pill");
}

/// Current pill state, for a pill webview that (re)loads mid-recording.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_pill_state() -> String {
    let state = *CURRENT.lock().unwrap_or_else(|e| e.into_inner());
    serde_json::to_value(state)
        .ok()
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_else(|| "idle".to_string())
}

#[tauri::command]
#[specta::specta]
pub fn tolkovo_get_pill_mode(app: AppHandle) -> PillMode {
    get_mode(&app)
}

#[tauri::command]
#[specta::specta]
pub fn tolkovo_set_pill_mode(app: AppHandle, mode: PillMode) {
    save_mode(&app, mode);
    refresh_visibility(&app);
}
