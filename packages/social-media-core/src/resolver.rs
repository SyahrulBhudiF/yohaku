use std::sync::Arc;

use js_sys::Function;
use wasm_bindgen::prelude::*;
use ytdown::{MediaInfo, Ytdown};

use crate::transport::JsHttpClient;

/// Reusable Rust resolver that delegates HTTP requests to the browser.
#[wasm_bindgen]
pub struct MediaResolver {
    inner: Ytdown,
}

#[wasm_bindgen]
impl MediaResolver {
    /// Create a resolver with a host-provided same-origin HTTP bridge.
    #[wasm_bindgen(constructor)]
    pub fn new(fetch: Function) -> Self {
        let transport = Arc::new(JsHttpClient::new(fetch));
        let inner = Ytdown::builder().build_with_transport(transport);

        Self { inner }
    }

    /// Resolve a public media URL into metadata and downloadable formats.
    pub async fn resolve(&self, url: &str) -> Result<JsValue, JsValue> {
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
}
