//! The menu-bar menu. Tolkovo lives in the menu bar (no Dock icon), and its
//! menu is deliberately short: Settings · Support the project · Stats · Quit,
//! plus last month's recap once it is ready and "Cancel recording" while a
//! recording is in progress. Handy's own tray menu
//! (version, model switcher, update checks, copy last transcript) is replaced
//! through one hook in `tray::build_menu`.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

/// Always build Tolkovo's menu instead of Handy's.
pub const ENABLED: bool = true;

/// Donations page (DONATE.md on GitHub). The only link the app opens.
const DONATE_URL: &str = "https://github.com/kozliq/Tolkovo/blob/main/DONATE.md";

pub const ID_DONATE: &str = "tolkovo_donate";
pub const ID_STATS: &str = "tolkovo_stats";
pub const ID_RECAP: &str = "tolkovo_recap";

/// Event telling the window which screen to show ("settings", "stats",
/// "recap") when it is opened from the menu.
pub const OPEN_EVENT: &str = "tk-open";

const MONTHS_GEN: [&str; 12] = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
];

/// Menu and tooltip for the menu-bar icon. Item ids `settings`, `cancel` and
/// `quit` are handled by Handy's existing menu handler in `lib.rs`; Tolkovo's
/// own ids go through [`handle`]. `recap` is last month's recap
/// `(month, opened)`: "Итоги сентября готовы" until opened, then quietly
/// "Итоги сентября".
pub fn build(
    app: &AppHandle,
    busy: bool,
    recap: Option<(u32, bool)>,
) -> tauri::Result<(Menu<tauri::Wry>, String)> {
    let settings = MenuItem::with_id(app, "settings", "Настройки…", true, Some("CmdOrCtrl+,"))?;
    let donate = MenuItem::with_id(app, ID_DONATE, "Поддержать проект", true, None::<&str>)?;
    let stats = MenuItem::with_id(app, ID_STATS, "Статистика", true, None::<&str>)?;
    let recap = match recap {
        Some((month, opened)) => {
            let name = MONTHS_GEN.get(month as usize - 1).copied().unwrap_or("");
            let label = if opened {
                format!("Итоги {name}")
            } else {
                format!("Итоги {name} готовы")
            };
            Some(MenuItem::with_id(app, ID_RECAP, label, true, None::<&str>)?)
        }
        None => None,
    };
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, Some("CmdOrCtrl+Q"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let cancel = MenuItem::with_id(app, "cancel", "Отменить запись", true, None::<&str>)?;

    let mut items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
    if busy {
        items.push(&cancel);
        items.push(&separator2);
    }
    items.push(&settings);
    items.push(&donate);
    items.push(&stats);
    if let Some(recap) = &recap {
        items.push(recap);
    }
    items.push(&separator);
    items.push(&quit);

    let menu = Menu::with_items(app, &items)?;
    Ok((menu, "Tolkovo".to_string()))
}

/// Tolkovo's own menu items. Returns false for ids it does not own.
pub fn handle(app: &AppHandle, id: &str) -> bool {
    match id {
        ID_DONATE => open_donate(app),
        ID_STATS => open_screen(app, "stats"),
        ID_RECAP => open_screen(app, "recap"),
        _ => return false,
    }
    true
}

/// Show the window on one screen (settings, stats or the recap).
pub fn open_screen(app: &AppHandle, screen: &str) {
    crate::show_main_window(app);
    let _ = app.emit(OPEN_EVENT, screen);
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
