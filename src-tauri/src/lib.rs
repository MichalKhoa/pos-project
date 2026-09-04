use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Clone, Default)]
pub struct AppState {
    pub child_process: Arc<Mutex<Option<CommandChild>>>,
}

fn is_backend_responsive(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .expect("Valid socket address");
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

fn spawn_sidecar(app: &AppHandle, state: &AppState) -> Result<(), String> {
    if is_backend_responsive(8000) {
        log::info!("Backend is already running on port 8000. Skipping sidecar spawn.");
        return Ok(());
    }

    log::info!("Spawning pos-backend sidecar...");
    match app.shell().sidecar("pos-backend") {
        Ok(command) => match command.spawn() {
            Ok((_rx, child)) => {
                log::info!("pos-backend sidecar spawned with PID: {}", child.pid());
                let mut lock = state.child_process.lock().map_err(|e| e.to_string())?;
                *lock = Some(child);
                Ok(())
            }
            Err(e) => {
                log::warn!("Failed to spawn pos-backend sidecar: {}", e);
                Err(e.to_string())
            }
        },
        Err(e) => {
            log::warn!("Sidecar command lookup failed: {}", e);
            Err(e.to_string())
        }
    }
}

fn kill_sidecar(state: &AppState) {
    if let Ok(mut lock) = state.child_process.lock() {
        if let Some(child) = lock.take() {
            log::info!("Terminating pos-backend sidecar (PID: {})...", child.pid());
            let _ = child.kill();
        }
    }
}

#[tauri::command]
fn restart_backend(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    log::info!("Restart backend command received.");
    kill_sidecar(&state);
    std::thread::sleep(Duration::from_millis(1000));
    spawn_sidecar(&app, &state)?;
    Ok("Backend restarted successfully".into())
}

#[tauri::command]
fn open_customer_display(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("customer-display") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "customer-display",
        tauri::WebviewUrl::App("/#/customer-display".into()),
    )
    .title("Himmel POS - Customer Display")
    .inner_size(1024.0, 768.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::default();
    let state_for_tray = app_state.clone();
    let state_for_exit = app_state.clone();

    tauri::Builder::default()
        .manage(app_state.clone())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Attempt to launch backend sidecar
            let handle = app.handle().clone();
            let init_state = app_state.clone();
            let _ = spawn_sidecar(&handle, &init_state);

            // Setup system tray menu
            let title_item = MenuItem::with_id(app, "title", "Himmel POS", false, None::<&str>)?;
            let open_item = MenuItem::with_id(app, "open", "Otevřít / Open Register", true, None::<&str>)?;
            let restart_item = MenuItem::with_id(app, "restart", "Restartovat backend", true, None::<&str>)?;
            let exit_item = MenuItem::with_id(app, "exit", "Ukončit / Exit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&title_item, &open_item, &restart_item, &exit_item],
            )?;

            let tray_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Himmel POS")
                .on_menu_event(move |_app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = tray_handle.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "restart" => {
                        let _ = restart_backend(tray_handle.clone(), State::from(&state_for_tray));
                    }
                    "exit" => {
                        kill_sidecar(&state_for_tray);
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Background health check thread to monitor backend availability
            std::thread::spawn(|| {
                let start = Instant::now();
                let timeout = Duration::from_secs(20);
                while start.elapsed() < timeout {
                    if is_backend_responsive(8000) {
                        log::info!("Backend health check succeeded at {:?}", start.elapsed());
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            restart_backend,
            open_customer_display
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                kill_sidecar(&state_for_exit);
            }
        });
}
