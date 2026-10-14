//! Stats and the monthly recap ("Итоги месяца").
//!
//! Only aggregates are kept — counters per day, per filler word, per frequent
//! word, per AI app — never the dictated text itself, so stats keep working
//! with history switched off. Everything stays in `tolkovo_stats.json` in the
//! app data folder; nothing is sent anywhere.
//!
//! One hook: [`record`] runs right before a dictation is pasted, on the main
//! thread, so the frontmost app is the one receiving the text.

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};

use chrono::{Datelike, Duration, Local, NaiveDate};
use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

const FILE: &str = "tolkovo_stats.json";
const STORE_PATH: &str = "tolkovo.json";
const KEY_ENABLED: &str = "stats_enabled";
const KEY_FILLERS: &str = "stats_fillers";

/// Frequent words kept per day; the long tail is dropped to bound the file.
const TOP_PER_DAY: usize = 300;

/// Filler words counted out of the box (whole words / phrases only).
pub const DEFAULT_FILLERS: &[&str] = &["короче", "типа", "ну", "как бы", "в общем", "блин", "эээ"];

/// Apps whose text box is a prompt to a neural network. Matched against the
/// frontmost app's name; only the name is stored.
const AI_APPS: &[&str] = &[
    "ChatGPT",
    "Claude",
    "Cursor",
    "Perplexity",
    "Windsurf",
    "Gemini",
    "Copilot",
    "DeepSeek",
    "Grok",
    "Codex",
    "LM Studio",
    "Ollama",
];

/// Words too common to be "your" words (compared after ё → е).
const STOP_WORDS: &[&str] = &[
    "это",
    "как",
    "что",
    "чтобы",
    "так",
    "вот",
    "все",
    "его",
    "она",
    "они",
    "оно",
    "мне",
    "меня",
    "мой",
    "моя",
    "мои",
    "мое",
    "тебе",
    "тебя",
    "твой",
    "тут",
    "там",
    "где",
    "когда",
    "если",
    "или",
    "для",
    "при",
    "про",
    "под",
    "над",
    "без",
    "через",
    "уже",
    "еще",
    "только",
    "тоже",
    "также",
    "был",
    "была",
    "были",
    "было",
    "быть",
    "будет",
    "есть",
    "нет",
    "надо",
    "нужно",
    "можно",
    "очень",
    "просто",
    "потом",
    "сейчас",
    "который",
    "которая",
    "которые",
    "которое",
    "этот",
    "эта",
    "эти",
    "этого",
    "этой",
    "того",
    "тот",
    "здесь",
    "нас",
    "вас",
    "них",
    "ним",
    "нам",
    "вам",
    "ему",
    "себя",
    "свой",
    "своя",
    "свои",
    "даже",
    "чем",
    "чего",
    "кто",
    "кого",
    "всех",
    "всем",
    "весь",
    "вся",
    "the",
    "and",
    "you",
    "for",
    "что-то",
    "как-то",
    "почему",
    "зачем",
    "тогда",
    "один",
    "одна",
    "два",
    "три",
    "раз",
    "ага",
    "угу",
    "вообще",
    "сам",
    "сама",
    "сами",
    "этом",
    "этим",
    "тем",
    "том",
    "мы",
    "вы",
    "он",
];

static WORD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*").unwrap());
static HESITATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:э{2,}м*|э+м+|м{3,})$").unwrap());

// ---------- Model ----------

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
struct Day {
    words: u64,
    dictations: u64,
    longest: u64,
    #[serde(default)]
    fillers: BTreeMap<String, u64>,
    #[serde(default)]
    apps: BTreeMap<String, u64>,
    #[serde(default)]
    top: BTreeMap<String, u64>,
}

#[derive(Serialize, Deserialize, Default, Debug)]
struct Db {
    /// "YYYY-MM-DD" (local) → counters.
    days: BTreeMap<String, Day>,
    /// "YYYY-MM" of the last recap the user opened.
    #[serde(default)]
    recap_seen: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Type, PartialEq)]
pub struct Counted {
    pub name: String,
    pub count: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Type, PartialEq)]
pub struct TopDay {
    pub date: String,
    pub words: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Type, PartialEq)]
pub struct StatsSummary {
    pub words: u64,
    pub dictations: u64,
    pub streak_days: u32,
    pub longest_dictation_words: u64,
    pub top_day: Option<TopDay>,
    pub fillers: Vec<Counted>,
    pub ai_prompts: u64,
    pub ai_apps: Vec<Counted>,
    pub top_words: Vec<Counted>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Type, PartialEq)]
pub struct MonthRecap {
    pub year: i32,
    pub month: u32,
    pub summary: StatsSummary,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StatsPeriod {
    Today,
    Week,
    Month,
    All,
}

// ---------- Text analysis (pure) ----------

/// What one dictation adds to the counters.
#[derive(Debug, Default, PartialEq)]
struct Analysis {
    words: u64,
    fillers: HashMap<String, u64>,
    top: HashMap<String, u64>,
}

fn tokens(text: &str) -> Vec<String> {
    WORD.find_iter(text)
        .map(|m| m.as_str().to_lowercase().replace('ё', "е"))
        .collect()
}

fn analyze(text: &str, fillers: &[String]) -> Analysis {
    let toks = tokens(text);
    let mut a = Analysis {
        words: toks.len() as u64,
        ..Default::default()
    };
    let mut phrases: Vec<(String, Vec<String>)> = fillers
        .iter()
        .map(|f| (f.trim().to_lowercase(), tokens(f)))
        .filter(|(_, t)| !t.is_empty())
        .collect();
    // Longer phrases first, so "в общем" is claimed before any one-word filler.
    phrases.sort_by_key(|(_, t)| std::cmp::Reverse(t.len()));
    let mut used = vec![false; toks.len()];

    for (name, phrase) in &phrases {
        let n = phrase.len();
        let mut i = 0;
        while i + n <= toks.len() {
            let hit = if name == "эээ" {
                HESITATION.is_match(&toks[i])
            } else {
                toks[i..i + n] == phrase[..]
            };
            if hit && !used[i..i + n].iter().any(|u| *u) {
                *a.fillers.entry(name.clone()).or_default() += 1;
                used[i..i + n].iter_mut().for_each(|u| *u = true);
                i += n;
            } else {
                i += 1;
            }
        }
    }

    for (t, used) in toks.iter().zip(used) {
        if used
            || t.chars().count() < 3
            || t.chars().all(|c| c.is_ascii_digit())
            || STOP_WORDS.contains(&t.as_str())
        {
            continue;
        }
        *a.top.entry(t.clone()).or_default() += 1;
    }
    a
}

/// The AI app name if the frontmost app is one, else `None`.
fn ai_app(frontmost: &str) -> Option<&'static str> {
    let lower = frontmost.to_lowercase();
    AI_APPS
        .iter()
        .find(|name| lower.contains(&name.to_lowercase()))
        .copied()
}

fn add(day: &mut Day, a: &Analysis, app: Option<&str>) {
    day.words += a.words;
    day.dictations += 1;
    day.longest = day.longest.max(a.words);
    for (k, v) in &a.fillers {
        *day.fillers.entry(k.clone()).or_default() += v;
    }
    for (k, v) in &a.top {
        *day.top.entry(k.clone()).or_default() += v;
    }
    if day.top.len() > TOP_PER_DAY + TOP_PER_DAY / 3 {
        let mut all: Vec<(String, u64)> = std::mem::take(&mut day.top).into_iter().collect();
        all.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        all.truncate(TOP_PER_DAY);
        day.top = all.into_iter().collect();
    }
    if let Some(app) = app {
        *day.apps.entry(app.to_string()).or_default() += 1;
    }
}

// ---------- Summaries (pure) ----------

fn key(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn sorted(map: HashMap<String, u64>, limit: usize) -> Vec<Counted> {
    let mut v: Vec<Counted> = map
        .into_iter()
        .filter(|(_, c)| *c > 0)
        .map(|(name, count)| Counted { name, count })
        .collect();
    v.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));
    v.truncate(limit);
    v
}

/// Days in a row with a dictation, ending today (or yesterday, so the streak
/// does not look broken in the morning before the first dictation).
fn streak(db: &Db, today: NaiveDate) -> u32 {
    let has = |d: NaiveDate| db.days.get(&key(d)).is_some_and(|x| x.dictations > 0);
    let mut d = if has(today) {
        today
    } else {
        today - Duration::days(1)
    };
    let mut n = 0;
    while has(d) {
        n += 1;
        d -= Duration::days(1);
    }
    n
}

fn summarize(db: &Db, from: Option<NaiveDate>, to: NaiveDate, streak_days: u32) -> StatsSummary {
    let (lo, hi) = (from.map(key), key(to));
    let mut s = StatsSummary {
        words: 0,
        dictations: 0,
        streak_days,
        longest_dictation_words: 0,
        top_day: None,
        fillers: vec![],
        ai_prompts: 0,
        ai_apps: vec![],
        top_words: vec![],
    };
    let (mut fillers, mut apps, mut top) = (HashMap::new(), HashMap::new(), HashMap::new());
    for (date, day) in &db.days {
        if lo.as_ref().is_some_and(|lo| date < lo) || *date > hi {
            continue;
        }
        s.words += day.words;
        s.dictations += day.dictations;
        s.longest_dictation_words = s.longest_dictation_words.max(day.longest);
        if day.words > 0 && s.top_day.as_ref().is_none_or(|t| day.words > t.words) {
            s.top_day = Some(TopDay {
                date: date.clone(),
                words: day.words,
            });
        }
        for (k, v) in &day.fillers {
            *fillers.entry(k.clone()).or_insert(0) += v;
        }
        for (k, v) in &day.apps {
            *apps.entry(k.clone()).or_insert(0) += v;
            s.ai_prompts += v;
        }
        for (k, v) in &day.top {
            *top.entry(k.clone()).or_insert(0) += v;
        }
    }
    s.fillers = sorted(fillers, 8);
    s.ai_apps = sorted(apps, 5);
    s.top_words = sorted(top, 8);
    s
}

fn period_start(period: StatsPeriod, today: NaiveDate) -> Option<NaiveDate> {
    match period {
        StatsPeriod::Today => Some(today),
        StatsPeriod::Week => Some(today - Duration::days(6)),
        StatsPeriod::Month => today.with_day(1),
        StatsPeriod::All => None,
    }
}

/// The month before `today`'s: (year, month, first day, last day).
fn previous_month(today: NaiveDate) -> (i32, u32, NaiveDate, NaiveDate) {
    let first_this = today.with_day(1).unwrap_or(today);
    let last_prev = first_this - Duration::days(1);
    let first_prev = last_prev.with_day(1).unwrap_or(last_prev);
    (last_prev.year(), last_prev.month(), first_prev, last_prev)
}

/// Last month's recap; the streak is the one at the end of that month.
fn recap_for(db: &Db, today: NaiveDate) -> Option<MonthRecap> {
    let (year, month, first, last) = previous_month(today);
    let summary = summarize(db, Some(first), last, streak(db, last));
    (summary.dictations > 0).then_some(MonthRecap {
        year,
        month,
        summary,
    })
}

// ---------- Storage ----------

static DB: Mutex<Option<Db>> = Mutex::new(None);

fn path(app: &AppHandle) -> Option<PathBuf> {
    crate::portable::app_data_dir(app)
        .ok()
        .map(|dir| dir.join(FILE))
}

fn with_db<T>(app: &AppHandle, f: impl FnOnce(&mut Db) -> T) -> T {
    let mut guard = DB.lock().unwrap_or_else(|e| e.into_inner());
    let db = guard.get_or_insert_with(|| {
        path(app)
            .and_then(|p| fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    });
    f(db)
}

fn save(app: &AppHandle) {
    let Some(p) = path(app) else { return };
    match with_db(app, |db| serde_json::to_string(db)) {
        Ok(json) => {
            if let Some(dir) = p.parent() {
                let _ = fs::create_dir_all(dir);
            }
            let tmp = p.with_extension("json.tmp");
            if let Err(e) = fs::write(&tmp, json).and_then(|_| fs::rename(&tmp, &p)) {
                log::error!("Failed to save stats: {e}");
            }
        }
        Err(e) => log::error!("Failed to serialize stats: {e}"),
    }
}

fn store_get(app: &AppHandle, key: &str) -> Option<serde_json::Value> {
    app.store(crate::portable::store_path(STORE_PATH))
        .ok()
        .and_then(|s| s.get(key))
}

pub fn enabled(app: &AppHandle) -> bool {
    store_get(app, KEY_ENABLED)
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

fn fillers(app: &AppHandle) -> Vec<String> {
    let mut list: Vec<String> = DEFAULT_FILLERS.iter().map(|s| s.to_string()).collect();
    let extra = store_get(app, KEY_FILLERS)
        .and_then(|v| serde_json::from_value::<Vec<String>>(v).ok())
        .unwrap_or_default();
    for w in extra {
        let w = w.trim().to_lowercase();
        if !w.is_empty() && !list.contains(&w) {
            list.push(w);
        }
    }
    list
}

/// Name of the app in front, i.e. the one receiving the paste.
#[cfg(target_os = "macos")]
fn frontmost_app() -> Option<String> {
    use objc2_app_kit::NSWorkspace;
    let app = NSWorkspace::sharedWorkspace().frontmostApplication()?;
    app.localizedName().map(|n| n.to_string())
}

#[cfg(not(target_os = "macos"))]
fn frontmost_app() -> Option<String> {
    None
}

/// Count one dictation. Call on the main thread right before the paste.
pub fn record(app: &AppHandle, text: &str) {
    if text.trim().is_empty() || !enabled(app) {
        return;
    }
    let ai = frontmost_app().as_deref().and_then(ai_app);
    let text = text.to_string();
    let app = app.clone();
    std::thread::spawn(move || {
        let analysis = analyze(&text, &fillers(&app));
        let today = key(Local::now().date_naive());
        let new_day = with_db(&app, |db| {
            let new_day = !db.days.contains_key(&today);
            add(db.days.entry(today).or_default(), &analysis, ai);
            new_day
        });
        save(&app);
        // A new day may start a new month: the recap item may need to appear.
        if new_day {
            crate::tray::update_tray_menu(&app);
        }
        let _ = app.emit("tk-stats-changed", ());
    });
}

/// Last month's recap for the menu: (month 1–12, already opened).
pub fn recap_menu_state(app: &AppHandle) -> Option<(u32, bool)> {
    let today = Local::now().date_naive();
    with_db(app, |db| {
        recap_for(db, today).map(|r| {
            let id = format!("{}-{:02}", r.year, r.month);
            (r.month, db.recap_seen.as_deref() == Some(id.as_str()))
        })
    })
}

// ---------- Commands ----------

#[tauri::command]
#[specta::specta]
pub fn tolkovo_stats_summary(app: AppHandle, period: StatsPeriod) -> StatsSummary {
    let today = Local::now().date_naive();
    with_db(&app, |db| {
        summarize(db, period_start(period, today), today, streak(db, today))
    })
}

/// Last month's recap; opening it marks it as seen (the menu item calms down).
#[tauri::command]
#[specta::specta]
pub fn tolkovo_stats_recap(app: AppHandle) -> Option<MonthRecap> {
    let today = Local::now().date_naive();
    let (recap, changed) = with_db(&app, |db| {
        let recap = recap_for(db, today);
        let id = recap.as_ref().map(|r| format!("{}-{:02}", r.year, r.month));
        let changed = id.is_some() && db.recap_seen != id;
        if changed {
            db.recap_seen = id;
        }
        (recap, changed)
    });
    if changed {
        save(&app);
        crate::tray::update_tray_menu(&app);
    }
    recap
}

#[tauri::command]
#[specta::specta]
pub fn tolkovo_stats_get_enabled(app: AppHandle) -> bool {
    enabled(&app)
}

#[tauri::command]
#[specta::specta]
pub fn tolkovo_stats_set_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    app.store(crate::portable::store_path(STORE_PATH))
        .map_err(|e| e.to_string())?
        .set(KEY_ENABLED, serde_json::json!(enabled));
    Ok(())
}

/// Forget every counter. History is not touched.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_stats_reset(app: AppHandle) {
    with_db(&app, |db| *db = Db::default());
    save(&app);
    crate::tray::update_tray_menu(&app);
    let _ = app.emit("tk-stats-changed", ());
}

/// Save the recap picture to Downloads and show it in Finder.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_save_png(app: AppHandle, name: String, bytes: Vec<u8>) -> Result<String, String> {
    use tauri::Manager;
    use tauri_plugin_opener::OpenerExt;
    let safe: String = name
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '\0'))
        .collect();
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let mut target = dir.join(format!("{safe}.png"));
    let mut n = 2;
    while target.exists() {
        target = dir.join(format!("{safe} {n}.png"));
        n += 1;
    }
    fs::write(&target, bytes).map_err(|e| e.to_string())?;
    let _ = app.opener().reveal_item_in_dir(&target);
    Ok(target.to_string_lossy().into_owned())
}

/// Put the recap picture on the clipboard.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_copy_png(bytes: Vec<u8>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSPasteboard, NSPasteboardTypePNG};
        use objc2_foundation::NSData;
        let data = NSData::with_bytes(&bytes);
        let pb = NSPasteboard::generalPasteboard();
        pb.clearContents();
        if unsafe { pb.setData_forType(Some(&data), NSPasteboardTypePNG) } {
            Ok(())
        } else {
            Err("pasteboard refused the image".into())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = bytes;
        Err("only on macOS".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn defaults() -> Vec<String> {
        DEFAULT_FILLERS.iter().map(|s| s.to_string()).collect()
    }

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn counts_russian_words() {
        let a = analyze("Привет, как дела? Из-за дождя — 5 минут.", &defaults());
        // привет, как, дела, из-за, дождя, 5, минут
        assert_eq!(a.words, 7);
        assert_eq!(analyze("   ", &defaults()).words, 0);
    }

    #[test]
    fn fillers_respect_word_boundaries() {
        let a = analyze(
            "Ну короче, нужно ну типа сделать. Коротко и нужно.",
            &defaults(),
        );
        assert_eq!(a.fillers.get("ну"), Some(&2));
        assert_eq!(a.fillers.get("короче"), Some(&1));
        assert_eq!(a.fillers.get("типа"), Some(&1));
        assert_eq!(a.fillers.len(), 3);
    }

    #[test]
    fn filler_phrases_and_hesitations() {
        let a = analyze("Это как бы в общем ээээ эмм как надо", &defaults());
        assert_eq!(a.fillers.get("как бы"), Some(&1));
        assert_eq!(a.fillers.get("в общем"), Some(&1));
        assert_eq!(a.fillers.get("эээ"), Some(&2));
        // The lone "как" is not a filler.
        assert_eq!(a.fillers.values().sum::<u64>(), 4);
    }

    #[test]
    fn top_words_skip_fillers_and_stop_words() {
        let a = analyze(
            "Короче давай сделаем проект, давай это сделаем",
            &defaults(),
        );
        assert_eq!(a.top.get("давай"), Some(&2));
        assert_eq!(a.top.get("сделаем"), Some(&2));
        assert!(!a.top.contains_key("короче"));
        assert!(!a.top.contains_key("это"));
    }

    #[test]
    fn recognizes_ai_apps_by_name() {
        assert_eq!(ai_app("ChatGPT"), Some("ChatGPT"));
        assert_eq!(ai_app("Claude"), Some("Claude"));
        assert_eq!(ai_app("Cursor"), Some("Cursor"));
        assert_eq!(ai_app("Telegram"), None);
    }

    fn db_with(days: &[(&str, &str, Option<&str>)]) -> Db {
        let mut db = Db::default();
        for (d, text, app) in days {
            add(
                db.days.entry(d.to_string()).or_default(),
                &analyze(text, &defaults()),
                *app,
            );
        }
        db
    }

    #[test]
    fn summary_and_streak() {
        let db = db_with(&[
            ("2026-09-29", "раз два три", None),
            ("2026-09-30", "короче пишем код", Some("Claude")),
            ("2026-10-01", "один два", Some("ChatGPT")),
            ("2026-10-02", "ну давай", None),
        ]);
        let today = date("2026-10-02");
        assert_eq!(streak(&db, today), 4);
        // Next morning, nothing dictated yet: the streak holds.
        assert_eq!(streak(&db, date("2026-10-03")), 4);
        assert_eq!(streak(&db, date("2026-10-05")), 0);

        let month = summarize(&db, period_start(StatsPeriod::Month, today), today, 4);
        assert_eq!(month.words, 4);
        assert_eq!(month.dictations, 2);
        assert_eq!(month.ai_prompts, 1);
        assert_eq!(month.ai_apps[0].name, "ChatGPT");

        let all = summarize(&db, None, today, 4);
        assert_eq!(all.words, 10);
        assert_eq!(all.ai_prompts, 2);
        assert_eq!(all.longest_dictation_words, 3);
        assert_eq!(all.top_day.unwrap().date, "2026-09-29");
    }

    #[test]
    fn recap_is_the_previous_month() {
        let db = db_with(&[
            ("2026-08-31", "старый месяц", None),
            ("2026-09-01", "короче начало", None),
            ("2026-09-30", "короче конец месяца", Some("Cursor")),
            ("2026-10-01", "новый месяц", None),
        ]);
        let r = recap_for(&db, date("2026-10-01")).unwrap();
        assert_eq!((r.year, r.month), (2026, 9));
        assert_eq!(r.summary.words, 5);
        assert_eq!(r.summary.fillers[0].name, "короче");
        assert_eq!(r.summary.fillers[0].count, 2);

        // January rolls back into December of the previous year.
        let (y, m, first, last) = previous_month(date("2027-01-15"));
        assert_eq!((y, m), (2026, 12));
        assert_eq!((first, last), (date("2026-12-01"), date("2026-12-31")));
        // A month with no dictations has no recap.
        assert!(recap_for(&db, date("2026-12-10")).is_none());
    }

    #[test]
    fn caps_frequent_words_per_day() {
        let text: String = (0..500).map(|i| format!("слово{i} ")).collect();
        let db = db_with(&[("2026-10-01", &text, None)]);
        assert!(db.days["2026-10-01"].top.len() <= TOP_PER_DAY + TOP_PER_DAY / 3);
    }
}
