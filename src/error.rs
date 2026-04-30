use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),

    #[error("Auth error: {0}")]
    Auth(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            AppError::Db(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
            AppError::Auth(m) => (StatusCode::UNAUTHORIZED, m.as_str()),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m.as_str()),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.as_str()),
        };

        if matches!(self, AppError::Db(_)) {
            tracing::error!("{self}");
        }

        (status, axum::Json(json!({ "error": msg }))).into_response()
    }
}
