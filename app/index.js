const {app, BrowserWindow} = require("electron");

var win,
    createWindow = () => {
        win = new BrowserWindow({show: false, width: 800, height: 600, minWidth: 800, minHeight: 600, icon: __dirname + "/../logo/logo.ico"});
        win.loadURL("file://" + __dirname + "/site/index.htm");
        win.setMenu(null);
        win.maximize();

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

app.on("activate", () => {
    if (win === null) {
        createWindow();
    }
});
