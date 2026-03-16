use tao::event_loop::EventLoopWindowTarget;
use tao::window::{Icon, Window, WindowBuilder};
use tracing::info;
use wry::{WebView, WebViewBuilder};

fn filename_from_path(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

/// Spawn a new IDE window that loads the frontend IDE route for the given file.
///
/// The caller must keep the returned `(Window, WebView)` alive for as long as
/// the window should remain open.
pub fn open_ide_window<E: 'static>(
    event_loop: &EventLoopWindowTarget<E>,
    base_url: &str,
    file_path: &str,
    icon: Option<Icon>,
    ipc_handler: impl Fn(wry::http::Request<String>) + 'static,
) -> (Window, WebView) {
    let filename = filename_from_path(file_path);
    let title = format!("{filename} — AURA IDE");

    let mut wb = WindowBuilder::new()
        .with_title(&title)
        .with_decorations(false)
        .with_inner_size(tao::dpi::LogicalSize::new(1100.0, 750.0));

    if let Some(ic) = icon {
        wb = wb.with_window_icon(Some(ic));
    }

    let window = wb.build(event_loop).expect("failed to build IDE window");

    let encoded_path = urlencoding::encode(file_path);
    let url = format!("{base_url}/ide?file={encoded_path}");
    info!(%url, "opening IDE window");

    let webview = WebViewBuilder::new()
        .with_url(&url)
        .with_ipc_handler(ipc_handler)
        .build(&window)
        .expect("failed to build IDE webview");

    (window, webview)
}
