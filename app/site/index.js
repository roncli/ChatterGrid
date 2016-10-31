onLoad = () => {
    window.addEventListener("dragover", (ev) => {
        ev.preventDefault();
    }, false);

    window.addEventListener("drop", (ev) => {
        var files;

        ev.preventDefault();
        if (ev.target.id === "drop") {
            files = ev.dataTransfer.files;
        }
    }, false);
};
