/// Shared test utilities for billing-related tests.
///
/// This module is public so downstream crates (aura-chat, aura-engine) can
/// reuse the mock billing server and session helpers instead of duplicating them.
use std::sync::Arc;

use aura_core::ZeroAuthSession;
use aura_store::RocksStore;

use crate::client::BillingClient;
use crate::metered::MeteredLlm;

pub static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub async fn start_mock_billing_server() -> String {
    use axum::{routing::{get, post}, Json, Router};
    use tokio::net::TcpListener;

    let app = Router::new()
        .route(
            "/api/credits/balance",
            get(|| async {
                Json(serde_json::json!({"balance": 999999, "purchases": []}))
            }),
        )
        .route(
            "/api/credits/debit",
            post(|| async {
                Json(serde_json::json!({
                    "success": true,
                    "balance": 999998,
                    "transactionId": "tx-1"
                }))
            }),
        );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    url
}

// ---------------------------------------------------------------------------
// Stateful mock billing server
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct DebitRecord {
    pub amount: u64,
    pub reason: String,
    pub metadata: Option<serde_json::Value>,
}

pub struct MockBillingState {
    pub balance: u64,
    pub debits: Vec<DebitRecord>,
}

impl MockBillingState {
    pub fn new(initial_balance: u64) -> Self {
        Self { balance: initial_balance, debits: Vec::new() }
    }
}

/// Start a mock billing server with mutable state: balance tracking,
/// debit recording, and `INSUFFICIENT_CREDITS` on overdraft.
pub async fn start_stateful_mock_billing_server(
    state: Arc<tokio::sync::Mutex<MockBillingState>>,
) -> String {
    use axum::{extract::State, routing::{get, post}, Json, Router};
    use tokio::net::TcpListener;

    type SharedState = Arc<tokio::sync::Mutex<MockBillingState>>;

    async fn balance_handler(State(st): State<SharedState>) -> axum::response::Response {
        let guard = st.lock().await;
        let body = serde_json::json!({"balance": guard.balance, "purchases": []});
        axum::response::IntoResponse::into_response(Json(body))
    }

    async fn debit_handler(
        State(st): State<SharedState>,
        Json(req): Json<serde_json::Value>,
    ) -> axum::response::Response {
        use axum::http::StatusCode;
        use axum::response::IntoResponse;
        let amount = req.get("amount").and_then(|v| v.as_u64()).unwrap_or(0);
        let reason = req.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let metadata = req.get("metadata").cloned();

        let mut guard = st.lock().await;
        guard.debits.push(DebitRecord { amount, reason, metadata });

        if amount > guard.balance {
            let body = serde_json::json!({
                "error": "INSUFFICIENT_CREDITS",
                "available": guard.balance,
                "required": amount,
            });
            return (StatusCode::BAD_REQUEST, Json(body)).into_response();
        }
        guard.balance -= amount;
        let body = serde_json::json!({
            "success": true,
            "balance": guard.balance,
            "transactionId": format!("tx-{}", guard.debits.len()),
        });
        axum::response::IntoResponse::into_response(Json(body))
    }

    let app = Router::new()
        .route("/api/credits/balance", get(balance_handler))
        .route("/api/credits/debit", post(debit_handler))
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    url
}

pub fn billing_client_for_url(url: &str) -> BillingClient {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("BILLING_SERVER_URL", url);
    BillingClient::new()
}

pub fn store_zero_auth_session(store: &RocksStore) {
    let session = serde_json::to_vec(&ZeroAuthSession {
        user_id: "u1".into(),
        network_user_id: None,
        profile_id: None,
        display_name: "Test".into(),
        profile_image: String::new(),
        primary_zid: "zid-1".into(),
        zero_wallet: "w1".into(),
        wallets: vec![],
        access_token: "test-token".into(),
        created_at: chrono::Utc::now(),
        validated_at: chrono::Utc::now(),
    })
    .unwrap();
    store.put_setting("zero_auth_session", &session).unwrap();
}

/// Create a fully wired `MeteredLlm` backed by a mock billing server and
/// the given `LlmProvider`. Returns the metered LLM and a temp dir (keep
/// it alive for the duration of the test).
pub async fn make_test_llm(
    provider: Arc<dyn aura_claude::LlmProvider>,
) -> (Arc<MeteredLlm>, tempfile::TempDir) {
    let url = start_mock_billing_server().await;
    let billing = Arc::new(billing_client_for_url(&url));
    let tmp = tempfile::TempDir::new().unwrap();
    let store = Arc::new(RocksStore::open(tmp.path()).unwrap());
    store_zero_auth_session(&store);
    let llm = Arc::new(MeteredLlm::new(provider, billing, store));
    (llm, tmp)
}

/// Like `make_test_llm`, but backed by a stateful mock server so tests can
/// inspect debit history and configure low balances.
pub async fn make_test_llm_stateful(
    provider: Arc<dyn aura_claude::LlmProvider>,
    state: Arc<tokio::sync::Mutex<MockBillingState>>,
) -> (Arc<MeteredLlm>, tempfile::TempDir) {
    let url = start_stateful_mock_billing_server(state).await;
    let billing = Arc::new(billing_client_for_url(&url));
    let tmp = tempfile::TempDir::new().unwrap();
    let store = Arc::new(RocksStore::open(tmp.path()).unwrap());
    store_zero_auth_session(&store);
    let llm = Arc::new(MeteredLlm::new(provider, billing, store));
    (llm, tmp)
}
