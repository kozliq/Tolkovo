//! Tolkovo: Liquid Glass background for the main settings window.
//!
//! On macOS the window is made transparent, its title bar is folded into the
//! content (the traffic lights float over the glass), and a native glass view
//! is placed behind the webview: `NSGlassEffectView` on macOS 26+, falling back
//! to `NSVisualEffectView` vibrancy on older releases (handled by
//! `tauri-plugin-liquid-glass`). Other platforms keep the regular opaque window.
//!
//! Kept in its own module so upstream Handy changes to `lib.rs` merge cleanly.

use tauri::{Manager, Runtime, WebviewWindow, WebviewWindowBuilder};

/// Adjust the main window builder for the glass look (macOS only).
#[cfg(target_os = "macos")]
pub fn configure_main_window<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    builder
        .transparent(true)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        // Tolkovo windows have fixed sizes from the mockups; the frontend
        // switches between onboarding (620×500) and settings (640×600).
        .inner_size(620.0, 500.0)
        .min_inner_size(620.0, 500.0)
        .resizable(false)
        .maximizable(false)
}

#[cfg(not(target_os = "macos"))]
pub fn configure_main_window<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    builder
}

/// Put the native glass material behind the main window's webview.
#[cfg(target_os = "macos")]
pub fn apply_to_main_window<R: Runtime>(window: &WebviewWindow<R>) {
    use tauri_plugin_liquid_glass::{GlassMaterialVariant, LiquidGlassConfig, LiquidGlassExt};

    let config = LiquidGlassConfig {
        variant: GlassMaterialVariant::Regular,
        ..Default::default()
    };
    if let Err(e) = window
        .app_handle()
        .liquid_glass()
        .set_effect(window, config)
    {
        log::warn!("Failed to apply Liquid Glass effect: {e}");
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_to_main_window<R: Runtime>(_window: &WebviewWindow<R>) {}
