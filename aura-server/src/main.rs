use std::net::SocketAddr;
use std::path::PathBuf;

use tokio::net::TcpListener;

fn default_data_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aura")
}

fn find_frontend_dir() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("frontend/dist"),
        PathBuf::from("../frontend/dist"),
    ];
    candidates
        .into_iter()
        .find(|p| p.join("index.html").exists())
}

#[tokio::main]
async fn main() {
    let data_dir = default_data_dir();
    std::fs::create_dir_all(&data_dir).expect("failed to create data directory");

    let db_path = data_dir.join("db");
    let state = aura_server::build_app_state(&db_path, &data_dir);

    let frontend_dir = find_frontend_dir();
    if let Some(ref dir) = frontend_dir {
        println!("Serving frontend from {}", dir.display());
    } else {
        println!(
            "No frontend dist found; API-only mode (connect frontend dev server to port 3100)"
        );
    }

    let app = aura_server::create_router_with_frontend(state, frontend_dir);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3100));
    println!("Aura server listening on http://{addr}");

    let listener = TcpListener::bind(addr).await.expect("failed to bind");
    axum::serve(listener, app).await.expect("server error");
}
