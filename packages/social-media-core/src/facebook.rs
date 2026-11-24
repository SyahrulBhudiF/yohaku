//! Facebook public video parsing.
//!
//! Facebook server-renders the progressive MP4 URLs of a public video into the
//! page as `browser_native_hd_url` / `browser_native_sd_url` (and, for older
//! pages, `playable_url_quality_hd` / `playable_url`). This module only parses
//! that payload; the resolver performs the request through the browser bridge.

#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

use std::time::Duration;

use serde::Serialize;
use url::Url;

/// Browser user agent for the public video page request.
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Media user agent for the CDN request. Facebook rate-limits browser agents
/// on media downloads, so the formats carry the crawler agent used by yt-dlp.
pub const MEDIA_USER_AGENT: &str = "facebookexternalhit/1.1";

#[derive(Debug, Serialize)]
pub struct FacebookVideo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub duration: Option<Duration>,
    pub uploader: Option<String>,
    pub webpage_url: String,
    pub is_live: bool,
    pub formats: Vec<FacebookFormat>,
}

#[derive(Debug, Serialize)]
pub struct FacebookFormat {
    pub url: String,
    pub mime_type: String,
    pub container: &'static str,
    pub bitrate: Option<u64>,
    pub http_headers: Vec<(String, String)>,
    pub video: FacebookVideoStream,
    pub audio: FacebookAudioStream,
}

#[derive(Debug, Serialize)]
pub struct FacebookVideoStream {
    pub codec: String,
}

#[derive(Debug, Serialize)]
pub struct FacebookAudioStream {
    pub codec: String,
    pub bitrate: Option<u64>,
}

/// Whether a URL belongs to a Facebook host this extractor understands.
pub fn matches(input: &str) -> bool {
    let Ok(url) = Url::parse(input) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    let host = host.to_ascii_lowercase();

    host == "fb.watch" || host == "facebook.com" || host.ends_with(".facebook.com")
}

/// Parse a public Facebook video page into the shared media metadata shape.
pub fn parse_page(html: &str, final_url: &str) -> Result<FacebookVideo, String> {
    parse_page_with_metadata(html, html, final_url)
}

/// Parse formats from one page and metadata from another. Facebook sometimes
/// serves a public video page without stream URLs but keeps them in the video
/// embed, so the embed supplies the formats and the page supplies the title.
pub fn parse_page_with_metadata(
    formats_html: &str,
    metadata_html: &str,
    final_url: &str,
) -> Result<FacebookVideo, String> {
    let (formats, anchor) = extract_formats(formats_html);

    if formats.is_empty() {
        return Err(no_formats_error(formats_html));
    }

    let webpage_url = final_url.split('#').next().unwrap_or(final_url).to_string();
    let parsed_url = Url::parse(&webpage_url).ok();
    let id = parsed_url
        .as_ref()
        .and_then(video_id)
        .or_else(|| json_string(metadata_html, "video_id").map(|(_, value)| value))
        .or_else(|| json_string(formats_html, "video_id").map(|(_, value)| value))
        .unwrap_or_else(|| "facebook".to_string());
    let title = meta_content(metadata_html, "og:title")
        .map(|value| clean_title(&decode_entities(&value)))
        .filter(|value| !value.is_empty())
        .or_else(|| {
            tag_text(metadata_html, "title").map(|value| clean_title(&decode_entities(&value)))
        })
        .filter(|value| !value.is_empty())
        .or_else(|| {
            meta_content(metadata_html, "og:description").map(|value| decode_entities(&value))
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Facebook video {id}"));
    let description = meta_content(metadata_html, "og:description")
        .map(|value| decode_entities(&value).trim().to_string())
        .filter(|value| !value.is_empty());
    let duration = anchor
        .and_then(|position| duration_ms(formats_html, position))
        .or_else(|| {
            first_video_key(metadata_html).and_then(|position| duration_ms(metadata_html, position))
        })
        .map(Duration::from_millis);

    Ok(FacebookVideo {
        id,
        title,
        description,
        duration,
        uploader: None,
        webpage_url,
        is_live: false,
        formats,
    })
}

/// The public embed page for a video URL, when its ID can be determined.
pub fn embed_url(input: &str) -> Option<String> {
    let url = Url::parse(input).ok()?;
    let id = video_id(&url)?;

    Some(format!(
        "https://www.facebook.com/video/embed?video_id={id}"
    ))
}

fn extract_formats(html: &str) -> (Vec<FacebookFormat>, Option<usize>) {
    let hd = json_string(html, "browser_native_hd_url")
        .or_else(|| json_string(html, "playable_url_quality_hd"))
        .or_else(|| json_string(html, "hd_src"));
    let sd = json_string(html, "browser_native_sd_url")
        .or_else(|| json_string(html, "playable_url"))
        .or_else(|| json_string(html, "sd_src"));

    let mut formats = Vec::new();
    let mut anchor = None;

    if let Some((position, url)) = hd {
        anchor = Some(position);
        push_format(&mut formats, url);
    }

    if let Some((position, url)) = sd {
        anchor.get_or_insert(position);
        push_format(&mut formats, url);
    }

    (formats, anchor)
}

fn no_formats_error(html: &str) -> String {
    let lowered = html.to_ascii_lowercase();

    if lowered.contains("you must log in")
        || lowered.contains("log in to continue")
        || lowered.contains("content isn't available")
    {
        return "Facebook served a login wall instead of the video. Only public videos work."
            .to_string();
    }

    "This Facebook post does not expose a downloadable video.".to_string()
}

fn first_video_key(html: &str) -> Option<usize> {
    [
        "browser_native_hd_url",
        "browser_native_sd_url",
        "playable_url_quality_hd",
        "playable_url",
        "hd_src",
        "sd_src",
    ]
    .iter()
    .filter_map(|key| html.find(key))
    .min()
}

fn push_format(formats: &mut Vec<FacebookFormat>, url: String) {
    if formats.iter().any(|format| format.url == url) {
        return;
    }

    let bitrate = url_bitrate(&url);

    formats.push(FacebookFormat {
        url,
        mime_type: "video/mp4".to_string(),
        container: "Mp4",
        bitrate,
        http_headers: vec![("user-agent".to_string(), MEDIA_USER_AGENT.to_string())],
        video: FacebookVideoStream {
            codec: "h264".to_string(),
        },
        audio: FacebookAudioStream {
            codec: "aac".to_string(),
            bitrate: None,
        },
    });
}

fn video_id(url: &Url) -> Option<String> {
    let segments: Vec<&str> = url
        .path_segments()?
        .filter(|segment| !segment.is_empty())
        .collect();
    let numeric =
        |value: &str| (5..=25).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_digit());

    if matches!(segments.first(), Some(&"watch"))
        || segments.first() == Some(&"video.php")
        || (segments.first() == Some(&"video") && segments.get(1) == Some(&"video.php"))
    {
        return url
            .query_pairs()
            .find(|(key, _)| key == "v")
            .map(|(_, value)| value.into_owned())
            .filter(|value| numeric(value));
    }

    if segments.first() == Some(&"reel") {
        return segments
            .get(1)
            .map(|value| value.to_string())
            .filter(|value| numeric(value));
    }

    if let Some(index) = segments.iter().position(|segment| *segment == "videos") {
        return segments[index + 1..]
            .iter()
            .rev()
            .map(|value| value.to_string())
            .find(|value| numeric(value));
    }

    None
}

fn url_bitrate(value: &str) -> Option<u64> {
    let url = Url::parse(value).ok()?;

    url.query_pairs()
        .find(|(key, _)| key == "bitrate")
        .and_then(|(_, value)| value.parse().ok())
}

fn duration_ms(html: &str, anchor: usize) -> Option<u64> {
    let prefix = html.get(..anchor.min(html.len()))?;
    let index = prefix.rfind("playable_duration_in_ms")?;
    let after = &prefix[index + "playable_duration_in_ms".len()..];
    let colon = after.find(':')?;
    let digits: String = after[colon + 1..]
        .chars()
        .skip_while(|character| character.is_whitespace())
        .take_while(|character| character.is_ascii_digit())
        .collect();
    let milliseconds = digits.parse().ok()?;

    (milliseconds > 0).then_some(milliseconds)
}

fn json_string(html: &str, key: &str) -> Option<(usize, String)> {
    let key_position = html.find(key)?;
    let after_key = &html[key_position + key.len()..];
    let colon = after_key.find(':')?;
    let after_colon = &after_key[colon + 1..];
    let quote = after_colon.find('"')?;
    let end = after_colon[quote + 1..].find('"')?;
    let value = unescape_json(&after_colon[quote + 1..quote + 1 + end]);

    value
        .starts_with("https://")
        .then_some((key_position, value))
}

fn unescape_json(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut characters = input.chars();

    while let Some(character) = characters.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }

        match characters.next() {
            Some('u') => {
                let hex: String = characters.by_ref().take(4).collect();

                if let Some(decoded) = u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32) {
                    output.push(decoded);
                }
            }
            Some('n') => output.push('\n'),
            Some('r') => output.push('\r'),
            Some('t') => output.push('\t'),
            Some('b') => output.push('\u{8}'),
            Some('f') => output.push('\u{c}'),
            Some(other) => output.push(other),
            None => break,
        }
    }

    output
}

fn meta_content(html: &str, property: &str) -> Option<String> {
    let marker = format!("property=\"{property}\"");
    let mut search_start = 0;

    while let Some(relative) = html[search_start..].find(&marker) {
        let position = search_start + relative;
        let tag_start = html[..position].rfind('<')?;
        let tag_end = position + html[position..].find('>')?;
        let tag = &html[tag_start..=tag_end];

        if let Some(value) = attribute(tag, "content") {
            return Some(value);
        }

        search_start = tag_end + 1;
    }

    None
}

fn attribute(tag: &str, name: &str) -> Option<String> {
    let marker = format!("{name}=\"");
    let start = tag.find(&marker)? + marker.len();
    let end = start + tag[start..].find('"')?;

    Some(tag[start..end].to_string())
}

fn tag_text(html: &str, name: &str) -> Option<String> {
    let open = html.find(&format!("<{name}"))?;
    let content_start = open + html[open..].find('>')? + 1;
    let content_end = content_start + html[content_start..].find(&format!("</{name}>"))?;

    Some(html[content_start..content_end].to_string())
}

fn clean_title(raw: &str) -> String {
    let mut parts: Vec<&str> = raw
        .split(" | ")
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();

    if parts.len() > 1
        && parts
            .last()
            .is_some_and(|part| part.eq_ignore_ascii_case("Facebook"))
    {
        parts.pop();
    }

    if parts.len() > 1 && parts[0].contains("views") && parts[0].contains("reactions") {
        parts.remove(0);
    }

    parts.join(" | ")
}

fn decode_entities(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(index) = rest.find('&') {
        output.push_str(&rest[..index]);
        rest = &rest[index..];

        let Some(end) = rest.find(';') else {
            output.push_str(rest);

            return output;
        };

        let entity = &rest[1..end];
        let decoded = if let Some(hex) = entity
            .strip_prefix("#x")
            .or_else(|| entity.strip_prefix("#X"))
        {
            u32::from_str_radix(hex, 16).ok().and_then(char::from_u32)
        } else if let Some(decimal) = entity.strip_prefix('#') {
            decimal.parse().ok().and_then(char::from_u32)
        } else {
            match entity {
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" => Some('\''),
                "nbsp" => Some(' '),
                _ => None,
            }
        };

        match decoded {
            Some(character) => output.push(character),
            None => output.push_str(&rest[..=end]),
        }

        rest = &rest[end + 1..];
    }

    output.push_str(rest);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = r#"<html><head>
        <title>How to share with just friends.</title>
        <meta property="og:title" content="2.8M views &#xb7; 1.3K reactions | How to share with just friends. | Facebook" />
        <meta property="og:description" content="How to share with just friends." />
        </head><body><script>{"videoDeliveryLegacyFields":{"playable_duration_in_ms":74304,"browser_native_sd_url":"https:\/\/video.xx.fbcdn.net\/sd.mp4?_nc_cat=1\u00253D","browser_native_hd_url":"https:\/\/video.xx.fbcdn.net\/hd.mp4?bitrate=2000000"}}</script></body></html>"#;

    const EMBED: &str = r#"<script>{"hd_src":"https:\/\/video.xx.fbcdn.net\/embed-hd.mp4?bitrate=900000","sd_src":"https:\/\/video.xx.fbcdn.net\/embed-sd.mp4?bitrate=400000"}</script>"#;

    #[test]
    fn matches_facebook_hosts_only() {
        assert!(matches("https://www.facebook.com/watch/?v=123456"));
        assert!(matches("https://m.facebook.com/reel/123456"));
        assert!(matches("https://fb.watch/abc123/"));
        assert!(!matches("https://fbcdn.net/watch?v=123456"));
        assert!(!matches(
            "https://facebook.com.attacker.invalid/watch?v=123456"
        ));
    }

    #[test]
    fn parses_public_video_page() {
        let video = parse_page(
            PAGE,
            "https://www.facebook.com/facebook/videos/10153231379946729/",
        )
        .unwrap();

        assert_eq!(video.id, "10153231379946729");
        assert_eq!(video.title, "How to share with just friends.");
        assert_eq!(
            video.description.as_deref(),
            Some("How to share with just friends.")
        );
        assert_eq!(video.duration, Some(Duration::from_millis(74304)));
        assert_eq!(video.formats.len(), 2);
        assert_eq!(
            video.formats[0].url,
            "https://video.xx.fbcdn.net/hd.mp4?bitrate=2000000"
        );
        assert_eq!(
            video.formats[1].url,
            "https://video.xx.fbcdn.net/sd.mp4?_nc_cat=1%3D"
        );
        assert_eq!(video.formats[0].bitrate, Some(2_000_000));
    }

    #[test]
    fn rejects_pages_without_a_public_stream() {
        let error = parse_page(
            "<html>You must log in to continue.</html>",
            "https://www.facebook.com/watch/?v=123456",
        )
        .unwrap_err();

        assert!(error.contains("login wall"));
    }

    #[test]
    fn merges_embed_formats_with_page_metadata() {
        let video = parse_page_with_metadata(
            EMBED,
            PAGE,
            "https://www.facebook.com/facebook/videos/10153231379946729/",
        )
        .unwrap();

        assert_eq!(video.title, "How to share with just friends.");
        assert_eq!(video.formats.len(), 2);
        assert_eq!(
            video.formats[0].url,
            "https://video.xx.fbcdn.net/embed-hd.mp4?bitrate=900000"
        );
        assert_eq!(video.duration, Some(Duration::from_millis(74304)));
    }

    #[test]
    fn builds_embed_url_from_video_ids() {
        assert_eq!(
            embed_url("https://www.facebook.com/watch/?v=10153231379946729").as_deref(),
            Some("https://www.facebook.com/video/embed?video_id=10153231379946729")
        );
        assert_eq!(
            embed_url("https://www.facebook.com/facebook/videos/10153231379946729/").as_deref(),
            Some("https://www.facebook.com/video/embed?video_id=10153231379946729")
        );
        assert_eq!(embed_url("https://fb.watch/abc123/"), None);
    }
}
