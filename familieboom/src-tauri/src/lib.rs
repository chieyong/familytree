// Native schil van de offline desktop-app. De frontend (React/Vite) doet het
// echte werk en bewaart de data zelf (localStorage in de webview). Deze schil
// laadt alleen de frontend; extra native plugins zijn (nog) niet nodig.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
