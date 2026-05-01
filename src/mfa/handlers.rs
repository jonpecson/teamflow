use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct MfaSetupResp {
    pub secret: String,
    pub uri: String,
}

#[derive(Deserialize)]
pub struct MfaVerifyReq {
    pub code: String,
}

/// Setup MFA: generate TOTP secret and return QR URI
pub async fn setup_mfa(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<MfaSetupResp>, AppError> {
    // Check if MFA already enabled
    let (mfa_enabled,): (bool,) = sqlx::query_as(
        "SELECT mfa_enabled FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    if mfa_enabled {
        return Err(AppError::BadRequest("MFA is already enabled".into()));
    }

    let (secret, uri) = super::generate_totp_secret(&claims.username)
        .map_err(AppError::BadRequest)?;

    // Store secret (not yet enabled — user must verify first)
    sqlx::query("UPDATE users SET totp_secret = $1 WHERE id = $2")
        .bind(&secret)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    crate::audit::log_mfa_event(&state.db, claims.sub, "setup", true).await;

    Ok(Json(MfaSetupResp { secret, uri }))
}

/// Verify TOTP code and enable MFA
pub async fn verify_mfa(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<MfaVerifyReq>,
) -> Result<StatusCode, AppError> {
    let (totp_secret,): (Option<String>,) = sqlx::query_as(
        "SELECT totp_secret FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    let secret = totp_secret
        .ok_or_else(|| AppError::BadRequest("MFA not set up. Call /api/mfa/setup first".into()))?;

    if !super::verify_totp(&secret, &body.code) {
        crate::audit::log_mfa_event(&state.db, claims.sub, "verify", false).await;
        return Err(AppError::BadRequest("Invalid TOTP code".into()));
    }

    // Enable MFA
    sqlx::query("UPDATE users SET mfa_enabled = true WHERE id = $1")
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    crate::audit::log_mfa_event(&state.db, claims.sub, "enabled", true).await;
    tracing::info!(user_id = %claims.sub, "MFA enabled");

    Ok(StatusCode::OK)
}

/// Validate TOTP during login (called after password auth)
pub async fn validate_mfa(
    State(state): State<AppState>,
    Json(body): Json<MfaValidateReq>,
) -> Result<Json<crate::auth::handlers::AuthResp>, AppError> {
    // Look up user by the temporary MFA token
    let (user_id, username, totp_secret): (uuid::Uuid, String, String) = sqlx::query_as(
        "SELECT id, username, totp_secret FROM users WHERE id = $1 AND mfa_enabled = true",
    )
    .bind(body.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Invalid MFA session".into()))?;

    if !super::verify_totp(&totp_secret, &body.code) {
        crate::audit::log_mfa_event(&state.db, user_id, "validate", false).await;
        return Err(AppError::Auth("Invalid TOTP code".into()));
    }

    // MFA passed — issue the actual JWT
    let token = crate::auth::jwt::sign_token(
        user_id,
        &username,
        &state.config.jwt_secret,
        state.config.jwt_expiry_secs,
    );

    crate::audit::log_mfa_event(&state.db, user_id, "validate", true).await;
    crate::audit::log_login(&state.db, user_id, &username, true, None).await;

    Ok(Json(crate::auth::handlers::AuthResp {
        token,
        user_id,
        username,
    }))
}

#[derive(Deserialize)]
pub struct MfaValidateReq {
    pub user_id: uuid::Uuid,
    pub code: String,
}
