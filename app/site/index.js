var electron = require("electron"),
    fs = require("fs"),
    path = require("path"),
    JSZip = require("jszip"),
    files = {},
    filenameRegex = /[/\\]([^/\\]+)\.([^/\\]+)$/,
    dirty = false,
    filterAllCg = {name: "All ChatterGrid files", extensions: ["chgd", "chgs"]},
    filterChgd = {name: "ChatterGrid grid definition", extensions: ["chgd"]},
    filterChgs = {name: "ChatterGrid sounds", extensions: ["chgs"]},
    angular, app, scope;

angular = require("angular"),
app = angular.module("chattergrid", []),

app.controller("chattergrid", ["$scope", function($scope) {
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

    $scope.delete = (sound) => {
        // TODO: Check for memory leak if we don't dispose of the Audio properly.
        delete files[sound.file];
        $scope.sounds.splice($scope.sounds.indexOf(sound), 1);
        dirty = true;
    };

    $scope.loadGrid = () => {
        new Promise((resolve, reject) => {
            if (dirty) {
                electron.remote.dialog.showMessageBox({
                    type: "question",
                    buttons: ["Yes, discard", "No, cancel"],
                    title: "Load Grid",
                    message: "You have unsaved changes to the current grid.  Discard the changes?",
                    cancelId: 1
                }, (response) => {
                    if (response === 0) {
                        resolve();
                    } else {
                        reject();
                    }
                });
            } else {
                resolve();
            }
        }).then(() => {
            electron.remote.dialog.showOpenDialog({
                title: "Load Grid",
                filters: [filterAllCg, filterChgd, filterChgs],
                properties: ["openFile"]
            }, (filenames) => {
                var filename;

                if (!filenames || filenames.length === 0) {
                    return;
                }

                filename = filenames[0];

                fs.readFile(filename, (err, data) => {
                    if (err) {
                        alert("There was a problem loading the file.");
                        return;
                    }

                    new Promise((resolve, reject) => {
                        JSZip.loadAsync(data).then((zip) => {
                            // Load the ZIP file.
                            zip.file("json").async("string").then((data) => {
                                try {
                                    var sounds = JSON.parse(data),
                                        promises;
                                    
                                    files = {};
                                    // TODO: Check for memory leak if we don't dispose of the Audio properly.
                                    $scope.sounds = [];

                                    promises = sounds.map((sound) => new Promise((resolve, reject) => {
                                        zip.file(sound.index.toString()).async("nodebuffer").then((data) => {
                                            checkFile({file: sound.file, data: data.toString("base64"), type: sound.type}, true);
                                            resolve();
                                        }).catch(reject);
                                    }));
                                    
                                    Promise.all(promises).then(() => {
                                        dirty = false;
                                        resolve();
                                    }).catch(reject);
                                } catch(err) {
                                    reject();
                                }
                            }).catch(reject);
                        }).catch(reject);
                    }).catch(() => {
                        // Load the JSON file.
                        try {
                            var sounds = JSON.parse(data.toString());
                            
                            files = {};
                            // TODO: Check for memory leak if we don't dispose of the Audio properly.
                            $scope.sounds = [];
                            
                            sounds.forEach((sound) => {
                                checkFile({file: sound.file, type: sound.type}, true);
                            });
                            dirty = false;
                        } catch (err) {
                            alert("There was a problem loading the file.");
                            return;
                        }
                    });
                });
            });
        }).catch(() => {});
    };

    $scope.saveGrid = () => {
        electron.remote.dialog.showSaveDialog({
            title: "Save Current Grid",
            filters: [filterChgd]
        }, (filename) => {
            var promises;

            if (!filename) {
                return;
            }

            promises = $scope.sounds.map((sound) => new Promise((resolve, reject) => {
                if (sound.data) {
                    sound.file = path.join(path.dirname(filename), sound.name + "." + sound.extension);
                    fs.writeFile(sound.file, new Buffer(sound.data, "base64"), (err) => {
                        if (err) {
                            reject();
                        }

                        resolve();
                    });
                } else {
                    resolve();
                }
            }));

            Promise.all(promises).then(() => {
                fs.writeFile(filename, JSON.stringify($scope.sounds.map((sound) => {
                    var audioFilename;

                    return {
                        file: sound.file,
                        type: sound.type
                    };
                })), (err) => {
                    if (err) {
                        alert("There was a problem saving the file.");
                        return;
                    }

                    dirty = false;
                    alert("Grid saved!");
                });
            }).catch(() => {
                alert("There was a problem saving the file.");
            });
        });
    };

    $scope.shareGrid = () => {
        electron.remote.dialog.showSaveDialog({
            title: "Share Current Grid",
            filters: [filterChgs]
        }, (filename) => {
            var zip, promises;

            if (!filename) {
                return;
            }

            zip = new JSZip();

            zip.file("json", JSON.stringify($scope.sounds.map((sound, index) => {
                return {
                    file: "/" + sound.name + "." + sound.extension,
                    type: sound.type,
                    index: index
                };
            })));

            promises = $scope.sounds.map((sound, index) => new Promise((resolve, reject) => {
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

            Promise.all(promises).then(() => {
                zip.generateAsync({
                    compression: "DEFLATE",
                    type: "nodebuffer"
                }).then((content) => {
                    fs.writeFile(filename, content, (err) => {
                        if (err) {
                            alert("There was a problem saving the file.");
                            return;
                        }

                        dirty = false;
                        alert("Grid saved!");
                    });
                }).catch((err) => {
                    alert("There was a problem saving the file.");
                });
            }).catch((err) => {
                alert("There was a problem saving the file.");
            });
        });
    };
}]);

$(document).ready(() => {
    $(window).on("dragover", (ev) => {
        ev.preventDefault();
        return false;
    });

    $(window).on("drop", (ev) => {
        var files;

        if (ev.target.id === "drop") {
            [].concat.apply([], ev.originalEvent.dataTransfer.files).forEach((file) => {
                checkFile({file: file.path, type: file.type});
            });
        }

        ev.preventDefault();
        return false;
    });

    scope = angular.element("html").scope();
});

checkFile = (opts, fromLoad) => {
    var file, type, data, audio;

    file = opts.file;
    type = opts.type;
    data = opts.data;

    if (files[file]) {
        alert("You've already added " + file + ".");
        return;
    }

    audio = new Audio(data ? "data:" + type + ";base64," + data : file);

    audio.onerror = (err) => {
        alert(file + " is not of a supported format.");
        err.cancelBubble = true;
        audio = null;
    };

    audio.onloadeddata = () => {
        var parsed = filenameRegex.exec(file);

        files[file] = type;
        scope.sounds.push({
            file: file,
            data: data,
            name: parsed[1],
            extension: parsed[2],
            type: type,
            audio: audio
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
