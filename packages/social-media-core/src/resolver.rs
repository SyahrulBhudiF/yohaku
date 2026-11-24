use std::sync::Arc;

use js_sys::Function;
use wasm_bindgen::prelude::*;
use ytdown::{HttpClient, HttpRequest, MediaInfo, Ytdown};

use crate::{facebook, transport::JsHttpClient};

/// Reusable Rust resolver that delegates HTTP requests to the browser.
#[wasm_bindgen]
pub struct MediaResolver {
    inner: Ytdown,
    http: Arc<JsHttpClient>,
}

#[wasm_bindgen]
impl MediaResolver {
    /// Create a resolver with a host-provided same-origin HTTP bridge.
    #[wasm_bindgen(constructor)]
    pub fn new(fetch: Function) -> Self {
        let transport = Arc::new(JsHttpClient::new(fetch));
        let inner = Ytdown::builder().build_with_transport(transport.clone());

        Self {
            inner,
            http: transport,
        }
    }

    /// Resolve a public media URL into metadata and downloadable formats.
    pub async fn resolve(&self, url: &str) -> Result<JsValue, JsValue> {
        if facebook::matches(url) {
            let video = self.resolve_facebook(url).await?;

            return serde_wasm_bindgen::to_value(&video)
                .map_err(|_| JsValue::from_str("The video metadata could not be read."));
        }

        let info = self
            .inner
            .resolve(url)
            .await
            .map_err(|error| JsValue::from_str(&error.to_string()))?;

        let MediaInfo::Single(video) = info else {
            return Err(JsValue::from_str(
                "Only individual video posts are supported, not playlists or collections.",
            ));
        };

        serde_wasm_bindgen::to_value(&video)
            .map_err(|_| JsValue::from_str("The video metadata could not be read."))
    }

    async fn resolve_facebook(&self, url: &str) -> Result<facebook::FacebookVideo, JsValue> {
        let request = HttpRequest::get("facebook", url)
            .header("accept", "text/html,application/xhtml+xml")
            .header("accept-language", "en-US,en;q=0.9")
            .header("user-agent", facebook::USER_AGENT);
        let response = self
            .http
            .execute(request)
            .await
            .map_err(|error| JsValue::from_str(&error.to_string()))?;

        if !response.is_success() {
            return Err(JsValue::from_str(&format!(
                "Facebook rejected this request (HTTP {}).",
                response.status
            )));
        }

        let body = String::from_utf8_lossy(&response.body);
        let final_url = response.final_url.as_deref().unwrap_or(url);
        let page_error = match facebook::parse_page(&body, final_url) {
            Ok(video) => return Ok(video),
            Err(message) => message,
        };
        let Some(embed_url) = facebook::embed_url(final_url) else {
            return Err(JsValue::from_str(&page_error));
        };
        let request = HttpRequest::get("facebook", embed_url)
            .header("accept", "text/html,application/xhtml+xml")
            .header("accept-language", "en-US,en;q=0.9")
            .header("user-agent", facebook::USER_AGENT);
        let embed = self
            .http
            .execute(request)
            .await
            .map_err(|_| JsValue::from_str(&page_error))?;

        if !embed.is_success() {
            return Err(JsValue::from_str(&page_error));
        }

        let embed_body = String::from_utf8_lossy(&embed.body);

        facebook::parse_page_with_metadata(&embed_body, &body, final_url)
            .map_err(|_| JsValue::from_str(&page_error))
    }
}
