use async_trait::async_trait;
use js_sys::{ArrayBuffer, Function, Object, Promise, Reflect, Uint8Array};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use ytdown::{Error, HttpClient, HttpRequest, HttpResponse};

pub struct JsHttpClient {
    fetch: Function,
}

// The callback is only invoked on wasm32's single JavaScript thread. This
// mirrors ytdown's documented browser transport contract.
unsafe impl Send for JsHttpClient {}
unsafe impl Sync for JsHttpClient {}

impl JsHttpClient {
    pub fn new(fetch: Function) -> Self {
        Self { fetch }
    }
}

#[async_trait(?Send)]
impl HttpClient for JsHttpClient {
    async fn execute(&self, request: HttpRequest) -> ytdown::Result<HttpResponse> {
        let headers = Object::new();

        for (name, value) in request.headers {
            Reflect::set(
                &headers,
                &JsValue::from_str(&name),
                &JsValue::from_str(&value),
            )
            .map_err(|cause| network_error(request.stage, cause))?;
        }

        let init = Object::new();
        let method = match request.method {
            ytdown::Method::Get => "GET",
            ytdown::Method::Post => "POST",
        };

        Reflect::set(
            &init,
            &JsValue::from_str("method"),
            &JsValue::from_str(method),
        )
        .map_err(|cause| network_error(request.stage, cause))?;
        Reflect::set(&init, &JsValue::from_str("headers"), &headers)
            .map_err(|cause| network_error(request.stage, cause))?;

        if let Some(body) = request.body {
            let body = Uint8Array::from(body.as_slice());
            Reflect::set(&init, &JsValue::from_str("body"), &body)
                .map_err(|cause| network_error(request.stage, cause))?;
        }

        let pending = self
            .fetch
            .call2(&JsValue::UNDEFINED, &JsValue::from_str(&request.url), &init)
            .map_err(|cause| network_error(request.stage, cause))?;
        let response = JsFuture::from(Promise::resolve(&pending))
            .await
            .map_err(|cause| network_error(request.stage, cause))?;
        let status = Reflect::get(&response, &JsValue::from_str("status"))
            .map_err(|cause| network_error(request.stage, cause))?
            .as_f64()
            .unwrap_or(502.0) as u16;
        let headers = Reflect::get(&response, &JsValue::from_str("headers"))
            .map_err(|cause| network_error(request.stage, cause))?;
        let get_header = Reflect::get(&headers, &JsValue::from_str("get"))
            .map_err(|cause| network_error(request.stage, cause))?
            .dyn_into::<Function>()
            .map_err(|cause| network_error(request.stage, cause))?;
        let final_url = get_header
            .call1(&headers, &JsValue::from_str("x-yohaku-final-url"))
            .ok()
            .and_then(|value| value.as_string());
        let array_buffer = Reflect::get(&response, &JsValue::from_str("arrayBuffer"))
            .map_err(|cause| network_error(request.stage, cause))?
            .dyn_into::<Function>()
            .map_err(|cause| network_error(request.stage, cause))?
            .call0(&response)
            .map_err(|cause| network_error(request.stage, cause))?;
        let array_buffer = JsFuture::from(Promise::resolve(&array_buffer))
            .await
            .map_err(|cause| network_error(request.stage, cause))?
            .dyn_into::<ArrayBuffer>()
            .map_err(|cause| network_error(request.stage, cause))?;
        let content_type = get_header
            .call1(&headers, &JsValue::from_str("content-type"))
            .ok()
            .and_then(|value| value.as_string());
        let response_headers = content_type
            .map(|value| vec![("content-type".to_string(), value)])
            .unwrap_or_default();

        Ok(HttpResponse {
            status,
            headers: response_headers,
            body: Uint8Array::new(&array_buffer).to_vec(),
            final_url,
        })
    }
}

fn network_error(stage: &'static str, cause: JsValue) -> Error {
    let message = cause
        .as_string()
        .unwrap_or_else(|| "the browser request failed".to_string());

    Error::Network { stage, message }
}
