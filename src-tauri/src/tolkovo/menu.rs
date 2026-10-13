//! The menu-bar menu. Tolkovo lives in the menu bar (no Dock icon), and its
//! menu is deliberately short: Settings · Support the project · Quit, plus
//! "Cancel recording" while a recording is in progress. Handy's own tray menu
//! (version, model switcher, update checks, copy last transcript) is replaced
//! through one hook in `tray::build_menu`.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

/// Always build Tolkovo's menu instead of Handy's.
pub const ENABLED: bool = true;

/// Donations page (DONATE.md on GitHub). The only link the app opens.
const DONATE_URL: &str = "https://github.com/kozliq/Tolkovo/blob/main/DONATE.md";

pub const ID_DONATE: &str = "tolkovo_donate";

/// Menu and tooltip for the menu-bar icon. Item ids `settings`, `cancel` and
/// `quit` are handled by Handy's existing menu handler in `lib.rs`.
pub fn build(app: &AppHandle, busy: bool) -> tauri::Result<(Menu<tauri::Wry>, String)> {
    let settings = MenuItem::with_id(app, "settings", "Настройки…", true, Some("CmdOrCtrl+,"))?;
    let donate = MenuItem::with_id(app, ID_DONATE, "Поддержать проект", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, Some("CmdOrCtrl+Q"))?;
    let separator = || PredefinedMenuItem::separator(app);

    let menu = if busy {
        let cancel = MenuItem::with_id(app, "cancel", "Отменить запись", true, None::<&str>)?;
        Menu::with_items(
            app,
            &[
                &cancel,
                &separator()?,
                &settings,
                &donate,
                &separator()?,
                &quit,
            ],
        )?
    } else {
        Menu::with_items(app, &[&settings, &donate, &separator()?, &quit])?
    };
    Ok((menu, "Tolkovo".to_string()))
}

/// Menu-bar icon colouring. Waiting is an empty capsule that macOS tints
/// for the menu bar (a template); writing is the burgundy capsule, which must
/// keep its colour — "empty pill waits, red pill writes".
pub fn icon_is_template(icon_path: &str) -> bool {
    !(icon_path.contains("recording") || icon_path.contains("transcribing"))
}

/// "Поддержать проект": open DONATE.md in the browser.
pub fn open_donate(app: &AppHandle) {
    if let Err(e) = app.opener().open_url(DONATE_URL, None::<&str>) {
        log::error!("Failed to open the donate page: {e}");
    }
}
