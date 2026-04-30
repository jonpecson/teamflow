use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateInviteReq {
    pub max_uses: Option<i32>,
    pub expires_in_hours: Option<i64>,
}

#[derive(Serialize)]
pub struct InviteResp {
    pub id: Uuid,
    pub code: String,
    pub created_by: String,
    pub max_uses: i32,
    pub uses: i32,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

fn generate_code() -> String {
    let mut rng = rand::rng();
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
    let code: String = (0..6).map(|_| chars[rng.random_range(0..chars.len())]).collect();
    format!("TF-{code}")
}

pub async fn create_invite(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<CreateInviteReq>,
) -> Result<(StatusCode, Json<InviteResp>), AppError> {
    let max_uses = body.max_uses.unwrap_or(10).min(50).max(1);
    let expires_at = body
        .expires_in_hours
        .map(|h| Utc::now() + Duration::hours(h.min(720).max(1)));

    // Try up to 5 times for unique code
    let mut code = generate_code();
    let mut attempts = 0;
    let row = loop {
        let result = sqlx::query_as::<_, (Uuid, String, i32, i32, Option<DateTime<Utc>>, DateTime<Utc>)>(
            "INSERT INTO invite_codes (code, created_by, max_uses, expires_at) \
             VALUES ($1, $2, $3, $4) \
             RETURNING id, code, max_uses, uses, expires_at, created_at",
        )
        .bind(&code)
        .bind(claims.sub)
        .bind(max_uses)
        .bind(expires_at)
        .fetch_one(&state.db)
        .await;

        match result {
            Ok(r) => break r,
            Err(sqlx::Error::Database(ref e)) if e.is_unique_violation() => {
                attempts += 1;
                if attempts >= 5 {
                    return Err(AppError::BadRequest("Failed to generate unique code".into()));
                }
                code = generate_code();
            }
            Err(e) => return Err(AppError::Db(e)),
        }
    };

    Ok((
        StatusCode::CREATED,
        Json(InviteResp {
            id: row.0,
            code: row.1,
            created_by: claims.username,
            max_uses: row.2,
            uses: row.3,
            expires_at: row.4,
            created_at: row.5,
        }),
    ))
}

pub async fn list_invites(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<Vec<InviteResp>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, Uuid, i32, i32, Option<DateTime<Utc>>, DateTime<Utc>)>(
        "SELECT ic.id, ic.code, ic.created_by, ic.max_uses, ic.uses, ic.expires_at, ic.created_at \
         FROM invite_codes ic \
         WHERE ic.uses < ic.max_uses \
         AND (ic.expires_at IS NULL OR ic.expires_at > now()) \
         ORDER BY ic.created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let mut invites = Vec::new();
    for r in rows {
        let creator = sqlx::query_as::<_, (String,)>("SELECT username FROM users WHERE id = $1")
            .bind(r.2)
            .fetch_optional(&state.db)
            .await?
            .map(|u| u.0)
            .unwrap_or_else(|| "unknown".into());

        invites.push(InviteResp {
            id: r.0,
            code: r.1,
            created_by: creator,
            max_uses: r.3,
            uses: r.4,
            expires_at: r.5,
            created_at: r.6,
        });
    }

    Ok(Json(invites))
}

pub async fn revoke_invite(
    State(state): State<AppState>,
    _claims: Claims,
    Path(invite_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM invite_codes WHERE id = $1")
        .bind(invite_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Invite not found".into()));
    }

    Ok(StatusCode::OK)
}

/// Validate an invite code (used during registration)
pub async fn validate_and_consume(
    db: &sqlx::PgPool,
    code: &str,
) -> Result<Uuid, AppError> {
    // Find valid invite
    let row = sqlx::query_as::<_, (Uuid, i32, i32)>(
        "SELECT id, max_uses, uses FROM invite_codes \
         WHERE code = $1 \
         AND uses < max_uses \
         AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(code)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Invalid or expired invite code".into()))?;

    // Increment uses
    sqlx::query("UPDATE invite_codes SET uses = uses + 1 WHERE id = $1")
        .bind(row.0)
        .execute(db)
        .await?;

    Ok(row.0)
}
