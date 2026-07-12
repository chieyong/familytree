// Native schil van de offline desktop-app. De frontend (React/Vite) doet het
// echte werk; hier registreren we alleen de SQLite-plugin (fase 2 gebruikt 'm
// voor de lokale opslag).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
