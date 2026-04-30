#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,teamflow=debug".into()),
        )
        .init();

    if let Err(e) = teamflow::start_server(None).await {
        tracing::error!("Server error: {e}");
        std::process::exit(1);
    }
}
