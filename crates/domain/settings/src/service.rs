use std::sync::Arc;

use aura_core::ApiKeyInfo;
use aura_store::RocksStore;

use crate::error::SettingsError;

pub struct SettingsService {
    #[allow(dead_code)] // store retained for SettingsService::new(store) API; API key is from env
    store: Arc<RocksStore>,
}

impl SettingsService {
    pub fn new(store: Arc<RocksStore>) -> Self {
        Self { store }
    }

    pub fn get_decrypted_api_key(&self) -> Result<String, SettingsError> {
        std::env::var("ANTHROPIC_API_KEY")
            .or_else(|_| {
                if std::env::var("AURA_ROUTER_URL").is_ok() {
                    Ok("router-managed".to_string())
                } else {
                    Err(std::env::VarError::NotPresent)
                }
            })
            .map_err(|_| SettingsError::ApiKeyNotSet)
    }

    pub fn get_api_key_info(&self) -> Result<ApiKeyInfo, SettingsError> {
        let configured = std::env::var("ANTHROPIC_API_KEY")
            .ok()
            .filter(|k| !k.is_empty())
            .is_some()
            || std::env::var("AURA_ROUTER_URL").is_ok();
        Ok(ApiKeyInfo { configured })
    }

    pub fn has_api_key(&self) -> bool {
        std::env::var("ANTHROPIC_API_KEY").is_ok() || std::env::var("AURA_ROUTER_URL").is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn make_service() -> SettingsService {
        let tmp = tempfile::TempDir::new().unwrap();
        let store = Arc::new(RocksStore::open(tmp.path()).unwrap());
        SettingsService::new(store)
    }

    fn clear_env() {
        std::env::remove_var("ANTHROPIC_API_KEY");
        std::env::remove_var("AURA_ROUTER_URL");
    }

    #[test]
    fn test_has_api_key_with_anthropic_key() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("ANTHROPIC_API_KEY", "sk-test-key");
        let svc = make_service();
        assert!(svc.has_api_key());
        clear_env();
    }

    #[test]
    fn test_has_api_key_with_router_url() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("AURA_ROUTER_URL", "https://router.example.com");
        let svc = make_service();
        assert!(svc.has_api_key());
        clear_env();
    }

    #[test]
    fn test_has_api_key_neither() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        let svc = make_service();
        assert!(!svc.has_api_key());
    }

    #[test]
    fn test_get_decrypted_api_key_anthropic() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("ANTHROPIC_API_KEY", "sk-real-key");
        let svc = make_service();
        assert_eq!(svc.get_decrypted_api_key().unwrap(), "sk-real-key");
        clear_env();
    }

    #[test]
    fn test_get_decrypted_api_key_router() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("AURA_ROUTER_URL", "https://router.example.com");
        let svc = make_service();
        assert_eq!(svc.get_decrypted_api_key().unwrap(), "router-managed");
        clear_env();
    }

    #[test]
    fn test_get_decrypted_api_key_neither() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        let svc = make_service();
        assert!(svc.get_decrypted_api_key().is_err());
    }

    #[test]
    fn test_get_api_key_info_with_router_url() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("AURA_ROUTER_URL", "https://router.example.com");
        let svc = make_service();
        let info = svc.get_api_key_info().unwrap();
        assert!(info.configured);
        clear_env();
    }

    #[test]
    fn test_anthropic_key_takes_precedence_over_router() {
        let _guard = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("ANTHROPIC_API_KEY", "sk-direct");
        std::env::set_var("AURA_ROUTER_URL", "https://router.example.com");
        let svc = make_service();
        assert_eq!(svc.get_decrypted_api_key().unwrap(), "sk-direct");
        clear_env();
    }
}
