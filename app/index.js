const main = require("@electron/remote/main");

main.initialize();

const {app, BrowserWindow} = require("electron");

let win;

/**
 * Creates the main window.
 * @returns {Promise} A promise that resolves when the main window has been created.
 */
const createWindow = async () => {
    win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        icon: `${__dirname}/../logo/logo.ico`
    });
    await win.loadURL(`file://${__dirname}/site/index.htm`);
    main.enable(win.webContents);
    win.setMenu(null);
    win.maximize();
    // win.webContents.toggleDevTools(); // Uncomment to debug.

    win.once("ready-to-show", () => {
        win.show();
    });

    win.on("closed", () => {
        win = null;
    });
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", async () => {
    if (win === null) {
        await createWindow();
    }
});
