/**
 * @typedef {{file: string, type: string, data?: string, name?: string}} CheckFileOptions
 */

const remote = require("@electron/remote"),
    fs = require("fs"),
    path = require("path"),
    JSZip = require("jszip"),
    filenameRegex = /[/\\](?<filename>[^/\\]+)\.(?<extension>[^/\\]+)$/,
    filterAllCg = {name: "All ChatterGrid files", extensions: ["chgd", "chgs"]},
    filterChgd = {name: "ChatterGrid grid definition", extensions: ["chgd"]},
    filterChgs = {name: "ChatterGrid sounds", extensions: ["chgs"]},
    angular = require("angular"),
    app = angular.module("chattergrid", []);

let dirty = false,
    files = {},
    scope;

/**
 * Checks a file.
 * @param {CheckFileOptions} opts The options for the file.
 * @param {boolean} [fromLoad] Defaults to false.  Whether this was called from loading.
 * @returns {void}
 */
const checkFile = (opts, fromLoad) => {
    let audio;

    const file = opts.file,
        type = opts.type,
        data = opts.data;

    if (files[file]) {
        alert(`You've already added ${file}.`);
        return;
    }

    audio = new Audio(data ? `data:${type};base64,${data}` : file);

    audio.onerror = (/** @type {Event} */err) => {
        alert(`${file} is not of a supported format.`);
        err.cancelBubble = true;
        audio = null;
    };

    audio.onloadeddata = () => {
        const parsed = filenameRegex.exec(file);

        files[file] = type;
        scope.sounds.push({
            file,
            data,
            filename: parsed.groups.filename,
            name: opts.name || parsed.groups.filename,
            extension: parsed.groups.extension,
            type,
            audio
        });

        audio.addEventListener("pause", () => {
            scope.$apply();
        });

        if (!fromLoad) {
            dirty = true;
        }

        scope.$apply();
    };
};

app.controller("chattergrid", [
    "$scope",
    function($scope) {
        $scope.sounds = [];

        $scope.play = (sound) => {
            sound.audio.play();
        };

        $scope.pause = (sound) => {
            sound.audio.pause();
        };

        $scope.stop = (sound) => {
            sound.audio.pause();
            sound.audio.currentTime = 0;
        };

        $scope.edit = (sound) => {
            sound.edit = !sound.edit;
            sound.nameEdit = sound.name;
        };

        $scope.changeName = (sound) => {
            sound.edit = false;
            sound.name = sound.nameEdit;
        };

        $scope.delete = (sound) => {
            // TODO: Check for memory leak if we don't dispose of the Audio properly.
            delete files[sound.file];
            $scope.sounds.splice($scope.sounds.indexOf(sound), 1);
            dirty = true;
        };

        $scope.loadGrid = async () => {
            if (dirty) {
                const response = await remote.dialog.showMessageBox({
                    type: "question",
                    buttons: ["Yes, discard", "No, cancel"],
                    title: "Load Grid",
                    message: "You have unsaved changes to the current grid.  Discard the changes?",
                    cancelId: 1
                });

                if (response.response === 1) {
                    return;
                }
            }

            const response = await remote.dialog.showOpenDialog({
                title: "Load Grid",
                filters: [filterAllCg, filterChgd, filterChgs],
                properties: ["openFile"]
            });

            if (response.canceled) {
                return;
            }

            const filenames = response.filePaths;

            if (!filenames || filenames.length === 0) {
                return;
            }

            const filename = filenames[0];

            fs.readFile(filename, async (err, data) => {
                if (err) {
                    alert("There was a problem loading the file.");
                    return;
                }

                try {
                    const zip = await JSZip.loadAsync(data);

                    // Load the ZIP file.
                    const unzippedJson = await zip.file("json").async("string");

                    const sounds = JSON.parse(unzippedJson);

                    files = {};

                    // TODO: Check for memory leak if we don't dispose of the Audio properly.

                    $scope.sounds = [];

                    const promises = sounds.map(async (sound) => {
                        const unzippedData = await zip.file(sound.index.toString()).async("nodebuffer");

                        checkFile({
                            file: sound.file,
                            data: unzippedData.toString("base64"),
                            type: sound.type,
                            name: sound.name
                        }, true);
                    });

                    await Promise.all(promises);

                    dirty = false;
                } catch {
                    // Load the JSON file.
                    try {
                        const sounds = JSON.parse(data.toString());

                        files = {};

                        // TODO: Check for memory leak if we don't dispose of the Audio properly.

                        $scope.sounds = [];

                        sounds.forEach((sound) => {
                            checkFile({
                                file: sound.file,
                                type: sound.type,
                                name: sound.name
                            }, true);
                        });
                        dirty = false;
                    } catch {
                        alert("There was a problem loading the file.");
                    }
                }
            });
        };

        $scope.saveGrid = async () => {
            const response = await remote.dialog.showSaveDialog({
                title: "Save Current Grid",
                filters: [filterChgd]
            });

            if (response.canceled || !response.filePath) {
                return;
            }

            const filename = response.filePath;

            const promises = $scope.sounds.map((sound) => new Promise((resolve, reject) => {
                if (sound.data) {
                    sound.file = path.join(path.dirname(filename), `${sound.name}.${sound.extension}`);
                    fs.writeFile(sound.file, Buffer.from(sound.data, "base64"), (err) => {
                        if (err) {
                            reject();
                        }

                        resolve();
                    });
                } else {
                    resolve();
                }
            }));

            try {
                await Promise.all(promises);

                fs.writeFile(filename, JSON.stringify($scope.sounds.map((sound) => ({
                    file: sound.file,
                    type: sound.type,
                    name: sound.name
                }))), (err) => {
                    if (err) {
                        alert("There was a problem saving the file.");
                        return;
                    }

                    dirty = false;
                    alert("Grid saved!");
                });
            } catch (err) {
                alert("There was a problem saving the file.");
            }
        };

        $scope.shareGrid = async () => {
            const response = await remote.dialog.showSaveDialog({
                title: "Share Current Grid",
                filters: [filterChgs]
            });

            if (response.canceled || !response.filePath) {
                return;
            }

            const filename = response.filePath;

            if (!filename) {
                return;
            }

            const zip = new JSZip();

            zip.file("json", JSON.stringify($scope.sounds.map((sound, index) => ({
                file: `/${sound.extension ? `${sound.filename}.${sound.extension}` : sound.filename}`,
                type: sound.type,
                name: sound.name,
                index
            }))));

            const promises = $scope.sounds.map((sound, index) => new Promise((resolve, reject) => {
                if (sound.data) {
                    zip.file(index.toString(), new Buffer(sound.data, "base64"), {binary: true});

                    resolve();
                } else {
                    fs.readFile(sound.file, (err, data) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        zip.file(index.toString(), data, {binary: true});

                        resolve();
                    });
                }
            }));

            try {
                await Promise.all(promises);

                const content = await zip.generateAsync({
                    compression: "DEFLATE",
                    type: "nodebuffer"
                });

                fs.writeFile(filename, content, (err) => {
                    if (err) {
                        alert("There was a problem saving the file.");
                        return;
                    }

                    dirty = false;
                    alert("Grid saved!");
                });
            } catch (err) {
                alert("There was a problem saving the file.");
            }
        };
    }
]);

$(document).ready(() => {
    $(window).on("dragenter dragleave dragover dragdrop", (ev) => {
        ev.preventDefault();
        return false;
    });

    $(window).on("drop", (ev) => {
        ev.preventDefault();

        Array.from(ev.originalEvent.dataTransfer.files).forEach((file) => {
            checkFile({file: file.path, type: file.type});
        });

        return false;
    });

    scope = angular.element("html").scope();
});
