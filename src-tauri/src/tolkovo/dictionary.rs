//! The personal dictionary: fixes words the Russian model writes in
//! Cyrillic ("гитхаб" → "GitHub", "пул реквест" → "pull request").
//!
//! Applied to the recognized text right before it is pasted, through
//! `tolkovo::polish` (one hook in `actions::process_transcription_output`). A starter set of common
//! anglicisms ships in `dictionary_starter.json`; the user's own rules live in
//! `tolkovo.json` and win over the starter set.
//!
//! Matching is by whole words and phrases, case-insensitive. A simple Russian
//! case ending after the last word is swallowed ("в гитхабе" → "в GitHub"),
//! longer phrases are tried first, and a key is never replaced inside a
//! longer word ("зум" leaves "зумер" alone).

use std::collections::HashMap;
use std::sync::Mutex;

use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "tolkovo.json";
const KEY_RULES: &str = "dictionary";

/// The starter set of common anglicisms, editable as plain JSON.
const STARTER_JSON: &str = include_str!("dictionary_starter.json");

/// Russian case endings that may follow the last word of a key.
const ENDINGS: &[&str] = &[
    "ами", "ями", "ого", "ому", "ах", "ях", "ам", "ям", "ов", "ев", "ом", "ем", "ой", "ей", "а",
    "я", "у", "ю", "е", "ы", "и",
];

/// One replacement: what the model writes → what it should be.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Type)]
pub struct Rule {
    pub from: String,
    pub to: String,
}

/// A compiled set of rules: one regex with every key as an alternative.
struct Compiled {
    regex: Regex,
    targets: HashMap<String, String>,
}

static CACHE: Mutex<Option<Compiled>> = Mutex::new(None);

/// Lowercase and collapse spaces, so "Пул  Реквест" and "пул реквест" meet.
fn normalize(key: &str) -> String {
    key.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn starter_rules() -> Vec<Rule> {
    serde_json::from_str(STARTER_JSON).unwrap_or_else(|e| {
        log::error!("Broken dictionary_starter.json: {e}");
        Vec::new()
    })
}

/// Build the matcher. Later rules override earlier ones with the same key, so
/// pass the starter set first and the user's rules last.
fn compile(rules: &[Rule]) -> Option<Compiled> {
    let mut targets: HashMap<String, String> = HashMap::new();
    let mut stems: Vec<(String, String)> = Vec::new();
    for rule in rules {
        let key = normalize(&rule.from);
        let to = rule.to.trim();
        if key.is_empty() || to.is_empty() {
            continue;
        }
        // Words ending in a vowel change it when declined (телега → телегу),
        // so the stem without it is a key too; it only matches with an
        // ending or on its own as a whole word.
        let last_word = key.rsplit(' ').next().unwrap_or("");
        if last_word.chars().count() > 3 && last_word.ends_with(['а', 'я', 'о', 'е', 'ь', 'й'])
        {
            let mut stem = key.clone();
            stem.pop();
            stems.push((stem, to.to_string()));
        }
        targets.insert(key, to.to_string());
    }
    // Full keys win over stems of other keys.
    for (stem, to) in stems {
        targets.entry(stem).or_insert(to);
    }
    if targets.is_empty() {
        return None;
    }
    // Longest keys first: regex alternation is leftmost-first, so "пул
    // реквест" must be tried before "пул".
    let mut keys: Vec<&String> = targets.keys().collect();
    keys.sort_by(|a, b| b.chars().count().cmp(&a.chars().count()).then(a.cmp(b)));
    let alternatives: Vec<String> = keys
        .iter()
        .map(|k| {
            k.split(' ')
                .map(regex::escape)
                .collect::<Vec<_>>()
                .join(r"\s+")
        })
        .collect();
    let pattern = format!(
        r"(?i)\b({})(?:{})?\b",
        alternatives.join("|"),
        ENDINGS.join("|")
    );
    match Regex::new(&pattern) {
        Ok(regex) => Some(Compiled { regex, targets }),
        Err(e) => {
            log::error!("Dictionary could not be compiled: {e}");
            None
        }
    }
}

fn replace(compiled: &Compiled, text: &str) -> String {
    compiled
        .regex
        .replace_all(text, |caps: &Captures| {
            let key = normalize(&caps[1]);
            compiled
                .targets
                .get(&key)
                .cloned()
                .unwrap_or_else(|| caps[0].to_string())
        })
        .into_owned()
}

/// The user's own rules from tolkovo.json.
pub fn user_rules(app: &AppHandle) -> Vec<Rule> {
    app.store(crate::portable::store_path(STORE_PATH))
        .ok()
        .and_then(|s| s.get(KEY_RULES))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

/// Fix the recognized text with the starter set and the user's rules.
pub fn apply(app: &AppHandle, text: &str) -> String {
    if text.is_empty() {
        return text.to_string();
    }
    let mut cache = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if cache.is_none() {
        let mut rules = starter_rules();
        rules.extend(user_rules(app));
        *cache = compile(&rules);
    }
    match cache.as_ref() {
        Some(compiled) => replace(compiled, text),
        None => text.to_string(),
    }
}

// ---------- Commands ----------

/// The user's own replacements, in the order they were added.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_dictionary_get(app: AppHandle) -> Vec<Rule> {
    user_rules(&app)
}

/// Save the user's replacements (the whole list) and rebuild the matcher.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_dictionary_set(app: AppHandle, rules: Vec<Rule>) -> Result<(), String> {
    let clean: Vec<Rule> = rules
        .into_iter()
        .map(|r| Rule {
            from: r.from.trim().to_string(),
            to: r.to.trim().to_string(),
        })
        .filter(|r| !r.from.is_empty() && !r.to.is_empty())
        .collect();
    let store = app
        .store(crate::portable::store_path(STORE_PATH))
        .map_err(|e| e.to_string())?;
    store.set(KEY_RULES, serde_json::json!(clean));
    *CACHE.lock().unwrap_or_else(|e| e.into_inner()) = None;
    Ok(())
}

/// How many words Tolkovo already knows out of the box.
#[tauri::command]
#[specta::specta]
pub fn tolkovo_dictionary_starter_count() -> u32 {
    starter_rules().len() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(from: &str, to: &str) -> Rule {
        Rule {
            from: from.into(),
            to: to.into(),
        }
    }

    fn fix(rules: &[Rule], text: &str) -> String {
        replace(&compile(rules).expect("rules compile"), text)
    }

    #[test]
    fn replaces_whole_words_case_insensitively() {
        let r = [rule("гитхаб", "GitHub")];
        assert_eq!(fix(&r, "Гитхаб упал"), "GitHub упал");
        assert_eq!(fix(&r, "ГИТХАБ"), "GitHub");
    }

    #[test]
    fn swallows_russian_case_endings() {
        let r = [rule("гитхаб", "GitHub"), rule("телега", "Telegram")];
        assert_eq!(fix(&r, "лежит на гитхабе"), "лежит на GitHub");
        assert_eq!(
            fix(&r, "скинь в гитхаб, а не в телегу"),
            "скинь в GitHub, а не в Telegram"
        );
        assert_eq!(fix(&r, "нет гитхаба"), "нет GitHub");
    }

    #[test]
    fn longer_phrases_win() {
        let r = [rule("пул", "pool"), rule("пул реквест", "pull request")];
        assert_eq!(fix(&r, "глянь пул реквест"), "глянь pull request");
        assert_eq!(fix(&r, "глянь пул  реквесты"), "глянь pull request");
        assert_eq!(fix(&r, "это пул"), "это pool");
    }

    #[test]
    fn never_touches_part_of_a_longer_word() {
        let r = [rule("зум", "Zoom"), rule("ну", "NU")];
        assert_eq!(fix(&r, "зумер в зуме"), "зумер в Zoom");
        assert_eq!(fix(&r, "нужно"), "нужно");
    }

    #[test]
    fn keeps_punctuation_and_surrounding_text() {
        let r = [rule("чат джипити", "ChatGPT")];
        assert_eq!(
            fix(&r, "Спроси у чат джипити, пожалуйста."),
            "Спроси у ChatGPT, пожалуйста."
        );
    }

    #[test]
    fn user_rules_override_starter_rules() {
        let r = [rule("телега", "Telegram"), rule("телега", "тележка")];
        assert_eq!(fix(&r, "телега"), "тележка");
    }

    #[test]
    fn empty_rules_are_ignored() {
        assert!(compile(&[rule("  ", "x"), rule("y", " ")]).is_none());
    }

    #[test]
    fn starter_set_loads_and_compiles() {
        let rules = starter_rules();
        assert!(rules.len() >= 150, "starter set has {} rules", rules.len());
        let c = compile(&rules).expect("starter set compiles");
        assert_eq!(replace(&c, "закинь в гитхаб"), "закинь в GitHub");
        assert_eq!(replace(&c, "открой чат джипити"), "открой ChatGPT");
    }
}
