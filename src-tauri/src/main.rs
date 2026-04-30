#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,teamflow=debug".into()),
        )
        .init();

    // Start the backend server in a background thread
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        rt.block_on(async {
            if let Err(e) = teamflow::start_server(None).await {
                tracing::error!("Backend server error: {e}");
            }
        });
    });

    // Give the server a moment to bind
    std::thread::sleep(std::time::Duration::from_millis(500));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running TeamFlow");
}
