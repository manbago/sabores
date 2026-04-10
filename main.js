/**
 * Sabor de España: The Hoops Challenge - Lanzador Escritorio
 * Creado por Manuel Bago Cobo
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// Importar electron-is-dev de forma segura. Si falla (en build final), forzamos false.
let isDev = false;
try {
    isDev = require('electron-is-dev');
} catch (e) {
    isDev = false;
}

let steamClient = null;
try {
    const steamworks = require('steamworks.js');
    steamClient = steamworks.init(4596230);
    // Make steamworks available globally so we can check it in renderer
    global.steamworks = steamworks;
    global.steamClient = steamClient;
    console.log("Steamworks API initialized successfully.");
} catch (e) {
    console.warn("Steamworks API could not be initialized:", e);
}

function createWindow() {
    // Definimos las características de la ventana del juego
    const win = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 1024,
        minHeight: 576,
        fullscreen: !isDev, // Fullscreen en producción para Steam
        autoHideMenuBar: true, // Oculta la barra nativa
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Permite comunicarnos desde JS al main
            devTools: isDev, // Desactivar inspector en el build final
            backgroundThrottling: false // No pausar el juego si se minimiza o pierde foco
        }
    });

    // Cargar el HTML principal
    win.loadFile('index.html');

    // Desactivar barra de menú por arriba
    win.removeMenu();

    if (isDev) {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Escuchar el evento de salida del botón SALIR
ipcMain.on('quit-app', () => {
    app.quit();
});
