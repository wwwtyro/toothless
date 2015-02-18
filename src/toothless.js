var request = require('request');
var sprintf = require('sprintf-js').sprintf;
var u = require('underscore');
var pretty = require('format-error');
var favicon = require('serve-favicon');
var jsonParser = require('body-parser').json();

var suspend = require('suspend');
var resume = suspend.resume;

var pubsub = require('./pubsub-hist');
var docker = require('./toothless-docker');
var volumes = require('./toothless-volumes');

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Express app initialization
app.disable('etag');
app.use(favicon(__dirname + '/static/images/favicon.ico'));
app.use('/static', express.static(__dirname + '/static'));

// Tracks the booting page pubsub channels.
var booting = {};

// -------------------------------------------------------------
// Kicks off and/or redirects to an app.
// -------------------------------------------------------------
app.get('/app', function(req, res) {

    // Get the repo name and tag.
    var repo = req.query.repo + ":latest";

    // validate repo name
    if (!volumes.validRepoPath(repo)) {
        res.send("There's something suspicious about that image name.");
        return;
    }

    // Is it already booting?
    if (booting[repo] !== undefined) {
        // Yes, redirect to boot page.
        var url = sprintf('http://localhost:9887/boot?repo=%s', repo);
        res.redirect(url);
        return;
    }

    // It's not booting.
    suspend.run(function *() { 

        // Is it already running and a singleton?
        var containerInfo = yield docker.getContainerInfo(repo, resume());
        if (containerInfo !== null) {
            var env = yield docker.getImageEnvVars(repo, resume());
            if (env.toothless_singleton === "true") {

                // Yes. Wait if it has a ready endpoint.
                if (env.toothless_ready_port && env.toothless_ready_endpoint) {
                    var waitUrl = sprintf("http://localhost:%s%s", 
                        docker.getContainerPublicPort(containerInfo, env.toothless_ready_port),
                        env.toothless_ready_endpoint);
                    yield waitContainer(waitUrl, resume());
                }

                // Redirect if it has a redirect endpoint.
                if (env.toothless_redirect_port && env.toothless_redirect_endpoint) {
                    var redirectUrl = sprintf("http://localhost:%s%s", 
                        docker.getContainerPublicPort(containerInfo, env.toothless_redirect_port),
                        env.toothless_redirect_endpoint);
                    res.redirect(redirectUrl);
                    return;
                }

                // Otherwise, indicate that it's running.
                res.send("That application is running, but doesn't have a web page to view.");
                return;
            }
        }

        // Create the booting channel.
        var ps = pubsub();
        booting[repo] = ps;

        // Redirect the client to the boot page.
        var url = sprintf('http://localhost:9887/boot?repo=%s', repo);
        res.redirect(url);

        // Is it already running?
        var containerInfo = yield docker.getContainerInfo(repo, resume());
        if (containerInfo !== null) {
            // Yes, so don't pull, just start it.
            start();
        } else {
            // Pull the image.
            var stream = yield docker.pullRepo(repo, resume());

            // Stream the pull updates to the client.
            stream.on('data', function(chunk) {
                chunk = chunk.toString('utf8');
                ps.publish('update', chunk);
            });
            // Called when image is finished pulling.
            stream.on('end', function() {
                start()
            });
        }

        function start() {
            suspend.run(function *() {

                var env = yield docker.getImageEnvVars(repo, resume());

                // Is it a toothless repo?
                if (!env.toothless) {
                    // No, implode.
                    ps.publish('err', "That is not a Toothless application.");
                    return;
                }

                // Start the app.
                yield docker.startContainer(repo, 
                                            env.toothless_X11 === "true", 
                                            env.toothless_PULSEAUDIO === "true", 
                                            resume());

                var containerInfo = yield docker.getContainerInfo(repo, resume());
                
                // Wait if it has a ready endpoint.
                if (env.toothless_ready_port && env.toothless_ready_endpoint) {
                    ps.publish('text', 'Waiting for app to start...');
                    var waitUrl = sprintf("http://localhost:%s%s", 
                        docker.getContainerPublicPort(containerInfo, env.toothless_ready_port),
                        env.toothless_ready_endpoint);
                    yield waitContainer(waitUrl, resume());
                }

                // Redirect if it has a redirect endpoint.
                if (env.toothless_redirect_port && env.toothless_redirect_endpoint) {
                    var redirectUrl = sprintf("http://localhost:%s%s", 
                        docker.getContainerPublicPort(containerInfo, env.toothless_redirect_port),
                        env.toothless_redirect_endpoint);
                    ps.publish('redirect', redirectUrl);
                    return;
                }

                // If the app wants us to indicate that it's running, do so.
                if (env.toothless_indicate_ready === "true") {
                    ps.publish('text', sprintf('%s has been started. You can close this window.', repo));
                    ps.publish('freeze', true);
                    return;
                } else {
                    // Otherwise, just close the window.
                    ps.publish('close', '');
                }

            }, function(err) {
                if (err) {
                    errorHandler("Error on pulling image.", err);
                    ps.publish('err', err);
                }
                setTimeout(function() {delete booting[repo]}, 5000);
            });
        }

    }, function(err) {
        errorHandler("Error in /app", err, req, res);
        if (err) {
            setTimeout(function() {delete booting[repo]}, 5000);
        }
    });

});


// -------------------------------------------------------------
// Updates the toothless UI data.
// -------------------------------------------------------------
app.get("/uidata", function(req, res) {
    suspend.run(function *() {

        var data = {
            containers: [],
            images: []
        };

        // Get running toothless containers.
        var containers = yield docker.getRunningToothlessContainers(resume());

        // Get toothless images.
        var images = yield docker.getToothlessImages(resume());

        // Fill out running container data.
        for (var i = 0; i < containers.length; i++) {
            var c = containers[i];
            var repoName = c.Config.Image;
            var env = yield docker.getImageEnvVars(repoName, resume());
            data.containers.push({
                name: repoName.split(':')[0], 
                singleton: env.toothless_singleton,
                id: c.Id
            });
        }
        
        // Fill out toothless image data.
        for (var i = 0; i < images.length; i++) {
            var im = images[i];
            var repoName = u.find(im.RepoTags, function(repotag) {
                return repotag.indexOf(":latest") !== -1;
            });
            if (repoName === undefined) {
                break;
            }
            var env = yield docker.getImageEnvVars(repoName, resume());
            data.images.push({
                name: repoName.split(':')[0],
                singleton: env.toothless_singleton
            });
        }

        // Post the data to the pubsub.
        res.send(JSON.stringify(data));

    }, function(err) {
        errorHandler("Error in toothlessUI.", err);
    });
});

// -------------------------------------------------------------
// Miscellaneous endpoints.
// -------------------------------------------------------------
app.get('/boot', function(req, res) {
    var url = sprintf('%s/static/boot.html', __dirname);
    res.sendFile(url);
});

app.get('/', function(req, res) {
    var url = sprintf('%s/static/toothless.html', __dirname);
    res.sendFile(url);
});

// -------------------------------------------------------------
// Miscellaneous api functions.
// -------------------------------------------------------------
app.post('/stop-container', jsonParser, function(req, res) {
    docker.stopContainerAsync(req.body.id);
    res.end();
});

app.post('/kill-container', jsonParser, function(req, res) {
    docker.killContainerAsync(req.body.id);
    res.end();
});

app.post('/uninstall-image', jsonParser, function(req, res) {
    docker.uninstallImage(req.body.repo + ":latest");
    res.end();
});

// -------------------------------------------------------------
// Handle socket connections.
// -------------------------------------------------------------
io.on('connection', function(socket) {
    socket.on("follow boot", function(msg) {
        if (!booting[msg]) {
            socket.emit('err', 'That application is not booting.')
            return;
        }
        booting[msg].subscribe(function(channel, msg) {
            socket.emit(channel, msg);
        });
    });
}, function(err) {
    errorHandler("Error in socket handler.", err);
});

// -------------------------------------------------------------
// Set up tasks.
// -------------------------------------------------------------
setInterval(docker.cleanUpContainers, 600 * 1000);

// -------------------------------------------------------------
// Kick off the server on port 9887.
// -------------------------------------------------------------
http.listen(9887, function(){
    console.log('listening on *:9887');
});

// -------------------------------------------------------------
// Waits for a webapp container to come online.
// -------------------------------------------------------------
function waitContainer(url, callback) {
    request(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(null);
        } else {
            setTimeout(waitContainer, 100, url, callback);
        }
    });
}

// -------------------------------------------------------------
// General purpose error handler
// -------------------------------------------------------------     
function errorHandler(label, err, req, res) {
    if (!err) {
        return;
    }
    console.log(label);
    msg = pretty.format(err, {
        noColor: true
    });
    console.log(msg);
    if (res) {
        res.status(500).send("<pre>500\n" + msg + "</pre>");
    }
}
