use sqlx::PgPool;

/// HIPAA: Message retention worker.
/// Deletes messages older than the channel's configured retention_days.
/// Runs daily. Channels with NULL retention_days keep messages forever.
pub async fn run_retention_worker(pool: PgPool) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(86400)); // daily

    loop {
        interval.tick().await;

        match delete_expired_messages(&pool).await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("Retention: deleted {count} expired messages");
                }
            }
            Err(e) => {
                tracing::error!("Retention worker error: {e}");
            }
        }

        // Also clean up expired revoked tokens
        match cleanup_revoked_tokens(&pool).await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("Cleaned up {count} expired revoked tokens");
                }
            }
            Err(e) => {
                tracing::error!("Revoked token cleanup error: {e}");
            }
        }
    }
}

async fn delete_expired_messages(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM messages WHERE channel_id IN (
            SELECT id FROM channels WHERE retention_days IS NOT NULL
        ) AND created_at < now() - (
            SELECT make_interval(days => c.retention_days)
            FROM channels c WHERE c.id = messages.channel_id
        )"
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

async fn cleanup_revoked_tokens(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("DELETE FROM revoked_tokens WHERE expires_at < now()")
        .execute(pool)
        .await?;

    Ok(result.rows_affected())
}
