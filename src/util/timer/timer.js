ym.modules.define('shri2017.imageViewer.util.timer', function (provide) {
    provide(
        function timer(params) {
            var repeats = params.repeats;
            var intervalId = setInterval(
                function () {
                    if (!--repeats) {
                        clearInterval(intervalId);
                    }
                    params.callback({
                        last: (repeats === 0)
                    });
                },
                params.interval
            );
        }
    );
});
