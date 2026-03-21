use std::path::PathBuf;

/// Create a temporary directory and return it alongside the canonicalized base path.
#[allow(dead_code)]
///
/// The caller must keep the returned `TempDir` alive for the duration of the test;
/// dropping it deletes the directory.
pub fn make_temp_base() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    (dir, base)
}
