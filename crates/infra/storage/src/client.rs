use std::env;

use reqwest::Client;
use tracing::info;

use crate::error::StorageError;

/// HTTP client for the aura-storage shared backend service.
///
/// Wraps `reqwest` with typed methods for each aura-storage API endpoint.
/// All authenticated requests accept a JWT token parameter forwarded as
/// `Authorization: Bearer <jwt>`.
#[derive(Clone)]
pub struct StorageClient {
    http: Client,
    base_url: String,
}

impl StorageClient {
    /// Create a new `StorageClient`, reading `AURA_STORAGE_URL` from env.
    /// Returns `None` if the env var is not set or empty (storage integration disabled).
    pub fn from_env() -> Option<Self> {
        let base_url = env::var("AURA_STORAGE_URL")
            .ok()
            .filter(|s| !s.is_empty())?;

        let base_url = base_url.trim_end_matches('/').to_string();
        info!(%base_url, "aura-storage client configured");

        Some(Self {
            http: Client::new(),
            base_url,
        })
    }

    #[cfg(test)]
    pub fn with_base_url(base_url: &str) -> Self {
        Self {
            http: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    // -----------------------------------------------------------------------
    // Internal HTTP helpers
    // -----------------------------------------------------------------------

    pub(crate) async fn get_authed<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        jwt: &str,
    ) -> Result<T, StorageError> {
        let resp = self.http.get(url).bearer_auth(jwt).send().await?;
        self.handle_response(resp).await
    }

    pub(crate) async fn post_authed<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        url: &str,
        jwt: &str,
        body: &B,
    ) -> Result<T, StorageError> {
        let resp = self
            .http
            .post(url)
            .bearer_auth(jwt)
            .json(body)
            .send()
            .await?;
        self.handle_response(resp).await
    }

    pub(crate) async fn put_authed<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        url: &str,
        jwt: &str,
        body: &B,
    ) -> Result<T, StorageError> {
        let resp = self
            .http
            .put(url)
            .bearer_auth(jwt)
            .json(body)
            .send()
            .await?;
        self.handle_response(resp).await
    }

    pub(crate) async fn put_authed_no_response<B: serde::Serialize>(
        &self,
        url: &str,
        jwt: &str,
        body: &B,
    ) -> Result<(), StorageError> {
        let resp = self
            .http
            .put(url)
            .bearer_auth(jwt)
            .json(body)
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(StorageError::Server {
                status: status.as_u16(),
                body,
            });
        }
        Ok(())
    }

    pub(crate) async fn delete_authed(&self, url: &str, jwt: &str) -> Result<(), StorageError> {
        let resp = self.http.delete(url).bearer_auth(jwt).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(StorageError::Server {
                status: status.as_u16(),
                body,
            });
        }
        Ok(())
    }

    async fn handle_response<T: serde::de::DeserializeOwned>(
        &self,
        resp: reqwest::Response,
    ) -> Result<T, StorageError> {
        let url = resp.url().to_string();
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(StorageError::Server {
                status: status.as_u16(),
                body,
            });
        }
        let body = resp
            .text()
            .await
            .map_err(|e| StorageError::Deserialize(e.to_string()))?;
        serde_json::from_str::<T>(&body).map_err(|e| {
            tracing::warn!(%url, error = %e, body_preview = &body[..body.len().min(500)], "Deserialization failed");
            StorageError::Deserialize(e.to_string())
        })
    }
}
