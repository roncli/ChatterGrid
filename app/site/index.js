var files = {},
    filenameRegex = /[/\\]([^/\\]+)\.([^/\\]+)$/,
    angular, app, scope;

window.$ = window.jQuery = require("../node_modules/jquery/dist/jquery.min.js");

angular = require("angular"),
app = angular.module("chattergrid", []),
require("../node_modules/bootstrap/dist/js/bootstrap.min.js");

app.controller("chattergrid", ["$scope", function($scope) {
    $scope.sounds = [];

    $scope.play = (sound) => {
        sound.audio.play();
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
                checkFile(file.path);
            });
        }

        ev.preventDefault();
        return false;
    });

    scope = angular.element("html").scope();
});

checkFile = (file) => {
    if (files[file]) {
        alert("You've already added " + file + ".");
        return;
    }

    var audio = new Audio(file);

    audio.onerror = (err) => {
        alert(file + " is not of a supported format.");
        err.cancelBubble = true;
        audio = null;
    };

    audio.onloadeddata = () => {
        var parsed = filenameRegex.exec(file);

        files[file] = true;
        scope.sounds.push({
            file: file,
            name: parsed[1],
            type: parsed[2],
            audio: audio
        });
        scope.$apply();
    };
};
