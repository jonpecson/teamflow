#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // In release builds, set defaults so users don't need a .env file.
    // .env file can still override these if present.
    let defaults = [
        ("DATABASE_URL", "postgresql://chatadmin:yHG6Z79IpgjVwbWXu4IB@chat-postgres.c3oogcagghcq.us-west-2.rds.amazonaws.com:5432/chat"),
        ("JWT_SECRET", "EmpireCrypto2026SecureJwtSigningKey!!"),
        ("BIND_ADDR", "127.0.0.1:8080"),
        ("AWS_REGION", "us-west-2"),
        ("HEARTBEAT_INTERVAL_SECS", "15"),
        ("CALL_MAX_DURATION_SECS", "14400"),
        ("CALL_RATE_LIMIT_PER_MIN", "5"),
    ];

    for (key, val) in defaults {
        if std::env::var(key).is_err() {
            std::env::set_var(key, val);
        }
    }

    // Still try .env for overrides
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,teamflow=info".into()),
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
    std::thread::sleep(std::time::Duration::from_millis(1500));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running TeamFlow");
}
