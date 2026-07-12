// Voorkomt een extra consolevenster op Windows in de release-build.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    familieboom_lib::run()
}
