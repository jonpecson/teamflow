use axum::extract::State;
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct UnfurlRequest {
    pub url: String,
}

#[derive(Serialize, Clone)]
pub struct UrlPreview {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub site_name: Option<String>,
}

fn is_safe_url(url: &str) -> bool {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return false;
    }
    // Block private/internal IPs
    let blocked = [
        "127.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
        "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
        "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
        "192.168.", "0.", "169.254.", "localhost", "[::1]",
    ];
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            for b in &blocked {
                if host.starts_with(b) || host == *b {
                    return false;
                }
            }
            return true;
        }
    }
    false
}

fn extract_og_tag(html: &str, property: &str) -> Option<String> {
    // Simple OG tag extraction without a full HTML parser
    let search = format!("property=\"og:{}\"", property);
    let search2 = format!("property='og:{}'", property);
    let search3 = format!("name=\"og:{}\"", property);

    for pattern in &[&search, &search2, &search3] {
        if let Some(pos) = html.find(pattern.as_str()) {
            // Look for content= nearby
            let region = &html[pos.saturating_sub(10)..html.len().min(pos + 500)];
            if let Some(content_pos) = region.find("content=\"") {
                let start = content_pos + 9;
                if let Some(end) = region[start..].find('"') {
                    let value = &region[start..start + end];
                    if !value.is_empty() {
                        return Some(html_escape::decode_html_entities(value).to_string());
                    }
                }
            }
            if let Some(content_pos) = region.find("content='") {
                let start = content_pos + 9;
                if let Some(end) = region[start..].find('\'') {
                    let value = &region[start..start + end];
                    if !value.is_empty() {
                        return Some(html_escape::decode_html_entities(value).to_string());
                    }
                }
            }
        }
    }

    // Also try with content before property
    let search_rev = format!("content=\"");
    for line in html.lines() {
        if line.contains(&format!("og:{}", property)) && line.contains(&search_rev) {
            if let Some(content_pos) = line.find("content=\"") {
                let start = content_pos + 9;
                if let Some(end) = line[start..].find('"') {
                    let value = &line[start..start + end];
                    if !value.is_empty() {
                        return Some(html_escape::decode_html_entities(value).to_string());
                    }
                }
            }
        }
    }

    None
}

pub async fn unfurl(
    State(state): State<AppState>,
    _claims: Claims,
    Json(req): Json<UnfurlRequest>,
) -> Result<Json<UrlPreview>, AppError> {
    if !is_safe_url(&req.url) {
        return Err(AppError::Validation("Invalid or unsafe URL".into()));
    }

    // Check cache (24h TTL)
    if let Ok(Some(cached)) = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT title, description, image_url, site_name FROM url_previews \
         WHERE url = $1 AND fetched_at > now() - interval '24 hours'",
    )
    .bind(&req.url)
    .fetch_optional(&state.db)
    .await
    {
        return Ok(Json(UrlPreview {
            url: req.url,
            title: cached.0,
            description: cached.1,
            image_url: cached.2,
            site_name: cached.3,
        }));
    }

    // Fetch the URL
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {}", e)))?;

    let resp = client
        .get(&req.url)
        .header("User-Agent", "TeamFlow-Bot/1.0")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Fetch error: {}", e)))?;

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !content_type.contains("text/html") {
        return Ok(Json(UrlPreview {
            url: req.url,
            title: None,
            description: None,
            image_url: None,
            site_name: None,
        }));
    }

    // Read only first 100KB
    let body = resp.text().await.map_err(|e| AppError::Internal(format!("Read error: {}", e)))?;
    let html = if body.len() > 102400 { &body[..102400] } else { &body };

    let title = extract_og_tag(html, "title")
        .or_else(|| {
            html.find("<title>").and_then(|start| {
                let start = start + 7;
                html[start..].find("</title>").map(|end| {
                    html_escape::decode_html_entities(&html[start..start + end]).to_string()
                })
            })
        });
    let description = extract_og_tag(html, "description");
    let image_url = extract_og_tag(html, "image");
    let site_name = extract_og_tag(html, "site_name");

    // Upsert cache
    let _ = sqlx::query(
        "INSERT INTO url_previews (url, title, description, image_url, site_name, fetched_at) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (url) DO UPDATE SET title = $2, description = $3, image_url = $4, site_name = $5, fetched_at = $6",
    )
    .bind(&req.url)
    .bind(&title)
    .bind(&description)
    .bind(&image_url)
    .bind(&site_name)
    .bind(Utc::now())
    .execute(&state.db)
    .await;

    Ok(Json(UrlPreview {
        url: req.url,
        title,
        description,
        image_url,
        site_name,
    }))
}
