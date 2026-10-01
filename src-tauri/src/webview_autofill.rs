//! WebView2's own form autofill ("Saved info" suggestions) and password saving are browser
//! features that do not belong in TaskMap: the database password field must never offer or store
//! anything outside TaskMap's own encryption.

/// Turns off WebView2 general autofill and password autosave for `window`. Failures are logged:
/// an older WebView2 runtime without these settings still runs TaskMap.
pub(crate) fn disable_webview_autofill(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    if let Err(error) = window.with_webview(|webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings4;
        use windows_core::Interface;
        // SAFETY: called on the webview's own thread by `with_webview`; COM calls on live objects.
        let result = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|core| core.Settings())
                .and_then(|settings| settings.cast::<ICoreWebView2Settings4>())
                .and_then(|settings| {
                    settings.SetIsGeneralAutofillEnabled(false)?;
                    settings.SetIsPasswordAutosaveEnabled(false)
                })
        };
        if let Err(error) = result {
            eprintln!("Failed to disable WebView2 autofill: {error}");
        }
    }) {
        eprintln!("Failed to reach the webview to disable autofill: {error}");
    }
    #[cfg(not(windows))]
    let _ = window;
}
