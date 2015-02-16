var socket = io();

window.onload = function() {

    var repo = getURLParameter('repo');

    socket.emit('follow boot', repo)

    var pcanvas = document.getElementById("progress");
    pcanvas.width = pcanvas.clientWidth;
    pcanvas.height = pcanvas.clientHeight;
    var ctx = pcanvas.getContext("2d");
    socket.on('update', function(msg) {
        msg = JSON.parse(msg);
        if (msg.progress !== undefined) {
            var progress = msg.progress ? msg.progress : "";
            progress = progress.substring(progress.indexOf('] ') + 2);
            var an = parseFloat(progress.split('/')[0]);
            var bn = parseFloat(progress.split('/')[1]);
            progress = an/bn;
            progress = progress > 1 ? 0 : progress;
            ctx.fillStyle = "rgb(212,212,212)";
            ctx.fillRect(0, 0, pcanvas.width, pcanvas.height);
            ctx.fillStyle = "rgb(0,128,255)";
            ctx.fillRect(0, 0, pcanvas.width * progress, pcanvas.height);
        } else {
            ctx.fillStyle = "rgb(255,255,255)";
            ctx.fillRect(0, 0, pcanvas.width, pcanvas.height);
        }
        document.getElementById("status").innerHTML = msg.status + "<br><br>";
    });

    socket.on('text', function(msg) {
        document.getElementById("status").innerHTML = msg;
    });

    socket.on('err', function(msg) {
        if (msg.json) {
            msg = msg.json;
        }
        document.getElementById("status").innerHTML = colorize(msg, 'red');
        freeze(true);
    });

    socket.on('redirect', function(msg) {
        location = msg;
    });

    socket.on('close', function() {
        window.close();
    });

    socket.on('freeze', function(val) {
        freeze(val);
    });

    var freeze = logo("render-canvas");

}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

function colorize(msg, color) {
    return "<span style='color:" + color +"'>" + msg + "</span>";
}
