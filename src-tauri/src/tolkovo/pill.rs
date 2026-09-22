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

/// Visible capsule size (logical points). Half the 64×140 of the mockups —
/// the author found the full size too big on screen.
const PILL_WIDTH: f64 = 32.0;
const PILL_HEIGHT: f64 = 70.0;
/// Transparent margin around the capsule so its drop shadow and the blob
/// transitions (which overshoot the capsule) aren't clipped.
const PILL_MARGIN: f64 = 16.0;
const WINDOW_WIDTH: f64 = PILL_WIDTH + PILL_MARGIN * 2.0;
const WINDOW_HEIGHT: f64 = PILL_HEIGHT + PILL_MARGIN * 2.0;

/// How long the drain animation runs before a "when recording" pill hides.
const DRAIN_MS: u64 = 700;
/// Length of the "melts into a blob" leave animation in the pill webview.
const LEAVE_MS: u64 = 600;
/// Voice level updates sent to the pill (the wave follows your voice).
const LEVEL_THROTTLE_MS: u64 = 40;

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
/// Bumped on every show/hide request so a delayed hide can tell it is stale.
static VISIBILITY_GENERATION: AtomicU64 = AtomicU64::new(0);
static LAST_LEVEL_EMIT: AtomicU64 = AtomicU64::new(0);
/// Where a drag started: cursor and window origin (logical points).
static DRAG_ORIGIN: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);

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
            // NSPanel hides itself whenever the app deactivates by default —
            // the pill blinked out on every app switch.
            .hides_on_deactivate(false)
            .corner_radius(0.0)
            .style_mask(StyleMask::empty().borderless().nonactivating_panel())
            .with_window(|w| {
                w.decorations(false)
                    .transparent(true)
                    .focusable(false)
                    .accept_first_mouse(true)
                    .skip_taskbar(true)
            })
            // Not pinned to every Space: on a Space switch the pill slides
            // away with the old desktop and is reborn on the new one as a
            // gathering blob (see watch_space_changes).
            .collection_behavior(
                CollectionBehavior::new()
                    .move_to_active_space()
                    .full_screen_auxiliary(),
            )
            .build()
        {
            Ok(panel) => {
                panel.hide();
                let window = app.get_webview_window(PILL_LABEL);
                if let Some(w) = &window {
                    prevent_activation(w);
                }
                window
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
    #[cfg(target_os = "macos")]
    watch_space_changes(app);
}

/// Clicking the pill must never activate Tolkovo: an active Tolkovo makes
/// macOS jump to the Space holding its settings window, throwing the user out
/// of the app they were dictating into. The panel's non-activating style
/// mask is applied after the window already exists (tauri-nspanel converts a
/// Tauri window), and AppKit only honours that flag when it is set at
/// creation, so set the underlying flag directly. `_setPreventsActivation:`
/// is private but long-standing; it is only sent if the window responds.
#[cfg(target_os = "macos")]
fn prevent_activation(window: &tauri::WebviewWindow) {
    use objc2::runtime::{AnyObject, Bool, Sel};
    use objc2::{msg_send, sel};

    let Ok(ptr) = window.ns_window() else {
        return;
    };
    let ns_window = ptr as *mut AnyObject;
    if ns_window.is_null() {
        return;
    }
    let selector: Sel = sel!(_setPreventsActivation:);
    unsafe {
        let responds: Bool = msg_send![&*ns_window, respondsToSelector: selector];
        if responds.as_bool() {
            let _: () = msg_send![&*ns_window, _setPreventsActivation: Bool::YES];
        } else {
            log::warn!("Pill window cannot opt out of app activation");
        }
    }
}

/// On every Space switch (swiping between desktops, entering a full-screen
/// app) the pill is reborn on the new Space: the webview hides it, the panel
/// is re-ordered onto the active Space, and it gathers from a blurred blob.
#[cfg(target_os = "macos")]
fn watch_space_changes(app: &AppHandle) {
    use block2::RcBlock;
    use objc2_app_kit::{NSWorkspace, NSWorkspaceActiveSpaceDidChangeNotification};
    use objc2_foundation::NSNotification;
    use std::ptr::NonNull;

    let app = app.clone();
    let block = RcBlock::new(move |_: NonNull<NSNotification>| {
        let visible = app
            .get_webview_window(PILL_LABEL)
            .map(|w| w.is_visible().unwrap_or(false))
            .unwrap_or(false);
        if visible {
            reborn(&app);
        }
    });
    unsafe {
        let center = NSWorkspace::sharedWorkspace().notificationCenter();
        let observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceActiveSpaceDidChangeNotification),
            None,
            None,
            &block,
        );
        // Lives for the whole app run.
        std::mem::forget(observer);
    }
}

/// Move the pill onto the active Space and play the "gathers from a blob"
/// entrance. The webview first goes invisible, so the re-order never flashes.
fn reborn(app: &AppHandle) {
    let _ = app.emit_to(PILL_LABEL, "tk-pill-prep", ());
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(40));
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            if let Some(w) = handle.get_webview_window(PILL_LABEL) {
                let _ = w.hide();
                let _ = w.show();
            }
        });
        std::thread::sleep(Duration::from_millis(40));
        let _ = app.emit_to(PILL_LABEL, "tk-pill-visible", true);
    });
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
    VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst);
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = app2.get_webview_window(PILL_LABEL) {
            // Re-showing a visible panel makes it blink, and WebKit skips a
            // running CSS transition when its window blinks — the drain
            // animation would jump straight to empty.
            if !w.is_visible().unwrap_or(false) {
                let _ = w.show();
            }
            // Plays the "blob gathers into a pill" enter animation (or
            // cancels a leave animation that is still running).
            let _ = w.emit_to(PILL_LABEL, "tk-pill-visible", true);
        }
    });
}

/// Hide with the "melts into a blob" animation, then unmap the window —
/// unless something asked to show it again in the meantime.
fn hide(app: &AppHandle) {
    let generation = VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let Some(w) = app.get_webview_window(PILL_LABEL) else {
        return;
    };
    if !w.is_visible().unwrap_or(false) {
        return;
    }
    let _ = w.emit_to(PILL_LABEL, "tk-pill-visible", false);
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(LEAVE_MS));
        if VISIBILITY_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        let app2 = app.clone();
        let _ = app.run_on_main_thread(move || {
            if let Some(w) = app2.get_webview_window(PILL_LABEL) {
                let _ = w.hide();
            }
        });
    });
}

/// Hook from Handy's `overlay::emit_levels` (audio callback, ~24 Hz): the
/// voice level makes the liquid's surface ripple while you speak.
pub fn on_levels(app: &AppHandle, levels: &[f32]) {
    if *CURRENT.lock().unwrap_or_else(|e| e.into_inner()) != PillState::Recording {
        return;
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    if now.saturating_sub(LAST_LEVEL_EMIT.load(Ordering::Relaxed)) < LEVEL_THROTTLE_MS {
        return;
    }
    LAST_LEVEL_EMIT.store(now, Ordering::Relaxed);
    let level = if levels.is_empty() {
        0.0
    } else {
        levels.iter().copied().fold(0.0_f32, f32::max)
    };
    let _ = app.emit_to(PILL_LABEL, "tk-pill-level", level.clamp(0.0, 1.0));
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

/// Drag the pill by hand instead of handing the window to the system drag
/// (`startDragging`): a system drag activates the app and made macOS jump to
/// the Space the window "belongs" to. Moving the frame ourselves never
/// activates anything, so the user stays in their app.
/// `phase` is "start" or "move"; coordinates are screen points.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_pill_drag(app: AppHandle, phase: String, screen_x: f64, screen_y: f64) {
    let Some(w) = app.get_webview_window(PILL_LABEL) else {
        return;
    };
    let mut origin = DRAG_ORIGIN.lock().unwrap_or_else(|e| e.into_inner());
    if phase == "start" {
        if let (Ok(pos), Ok(scale)) = (w.outer_position(), w.scale_factor()) {
            *origin = Some((
                screen_x,
                screen_y,
                pos.x as f64 / scale,
                pos.y as f64 / scale,
            ));
        }
        return;
    }
    if let Some((cx, cy, wx, wy)) = *origin {
        let _ = w.set_position(tauri::Position::Logical(tauri::LogicalPosition {
            x: wx + (screen_x - cx),
            y: wy + (screen_y - cy),
        }));
    }
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
