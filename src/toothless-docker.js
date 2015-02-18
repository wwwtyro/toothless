var pretty = require('format-error');
var u = require('underscore');
var sprintf = require('sprintf-js').sprintf;

var Docker = require('dockerode');
var docker = new Docker({socketPath: '/var/run/docker.sock'});

var suspend = require('suspend');
var resume = suspend.resume;

var volumes = require('./toothless-volumes')

// -------------------------------------------------------------
// General purpose error handler
// -------------------------------------------------------------
function errorHandler(err) {
    if (!err) {
        return;
    }
    msg = pretty.format(err, {
        noColor: true
    });
    console.log(msg);
}

// -------------------------------------------------------------
// Clean up exited toothless containers
// -------------------------------------------------------------
function cleanUpContainers() {
    suspend.run(function *() {

        var opts = {
            all: true,
            filters: JSON.stringify({
                status: ["exited"]
            })
        };
        var containers = yield docker.listContainers(opts, resume());
        for (var i = 0; i < containers.length; i++ ) {
            var container = docker.getContainer(containers[i].Id);
            var info = yield container.inspect(resume());
            if (u.contains(info.Config.Env, "toothless=true")) {
                yield container.remove(resume());
                console.log(sprintf("Removed container %s", containers[i].Id))
            }
        }

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Get environment variable from toothless image.
// -------------------------------------------------------------
function getImageEnvVars(repo, callback) {
    suspend.run(function *() {

        var vars = {}
        var image = docker.getImage(repo);
        var inspect = yield image.inspect(resume());
        inspect.Config.Env.forEach(function(env) {
            vars[env.split('=')[0]] = env.split('=')[1];
        });
        callback(null, vars);

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Returns a list of toothless image inspections.
// -------------------------------------------------------------
function getToothlessImages(callback) {
    suspend.run(function *() {

        toothlessImages = [];
        var imagesInfo = yield docker.listImages(resume());
        for (var i = 0; i < imagesInfo.length; i++) {
            var image = docker.getImage(imagesInfo[i].Id);
            var inspect = yield image.inspect(resume());
            if (u.contains(inspect.ContainerConfig.Env, "toothless=true")) {
                toothlessImages.push(imagesInfo[i]);
            }
        }
        callback(null, toothlessImages);

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Returns a toothless image.
// -------------------------------------------------------------
function getToothlessImage(callback) {
    suspend.run(function *() {

        var images = yield docker.getToothlessImages(resume());
        var imageInfo = u.find(images, function(image) {
            return u.find(image.RepoTags, function(repotag) {
                return repotag === repo;
            });
        });

        callback(null, imageInfo);

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Returns information about a container if it exists.
// -------------------------------------------------------------
function getContainerInfo(repo, callback) {
    suspend.run(function *() {

        var containers = yield docker.listContainers(resume());
        for (var i = 0; i < containers.length; i++) {
            if (containers[i].Image === repo) {
                callback(null, containers[i]);
                return;
            } 
        }
        callback(null, null);

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Returns the public port associated with this container.
// -------------------------------------------------------------
function getContainerPublicPort(containerInfo, port) {
    for (var i = 0; i < containerInfo.Ports.length; i++) {
        if (containerInfo.Ports[i].PrivatePort == port) {
            return containerInfo.Ports[i].PublicPort;
        }
    }
    return null;
}

// -------------------------------------------------------------
// Starts a container.
// -------------------------------------------------------------
function startContainer(repo, x11, pulse, callback) {
    suspend.run(function *() {

        // Ensure the volumes exist for the app.
        volumes.createVolume(repo);

        // Prepare the container options.
        var opts = {
            Image: repo,
            Env: [],
            HostConfig: {
                PublishAllPorts: true,
                Binds: [
                    sprintf('%s:/toothless/shared', volumes.sharedPath),
                    sprintf('%s:/toothless/local', volumes.getRepoPath(repo))
                ],
            }
        }

        // Handle X11 support.
        if (x11) {
            opts.Env.push(sprintf("DISPLAY=%s", process.env.DISPLAY));
            opts.HostConfig.Binds.push("/tmp/.X11-unix:/tmp/.X11-unix:ro");
        }

        // Handle PulseAudio support.
        if (pulse) {
            opts.Env.push("PULSE_SERVER=tcp:172.17.42.1:4713");
        }

        // Create & start the container.
        var container = yield docker.createContainer(opts, resume());
        yield container.start(resume());
        callback(null);

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Stops a container.
// -------------------------------------------------------------
function stopContainerAsync(id) {
    var c = docker.getContainer(id);
    c.stop(function(err, data) {
        errorHandler(err);
    });
}

// -------------------------------------------------------------
// This kills the container.
// -------------------------------------------------------------
function killContainerAsync(id) {
    var c = docker.getContainer(id);
    c.kill(function(err, data) {
        errorHandler(err);
    });
}

// -------------------------------------------------------------
// Uninstall an app.
// -------------------------------------------------------------
function uninstallImage(repo) {
    suspend.run(function *() {

        // Stop containers of this repo.
        var containers = yield docker.listContainers(resume());
        for (var i = 0; i < containers.length; i++) {
            if (containers[i].Image === repo) {
                var c = docker.getContainer(containers[i].Id);
                yield c.kill(resume());
            }
        }
        // Remove the image.
        var image = docker.getImage(repo);
        var opts = {
            force: true
        }
        yield image.remove(opts, resume());
        volumes.removeVolume(repo);

    }, errorHandler);
}

// -------------------------------------------------------------
// Docker pull wrapper.
// -------------------------------------------------------------
function pullRepo(repo, callback) {
    docker.pull(repo, callback);
}

// -------------------------------------------------------------
// Returns list of toothless's running containers.
// -------------------------------------------------------------
function getRunningToothlessContainers(callback) {
    suspend.run(function *() {

        var containers = [];
        var allContainers = yield docker.listContainers(resume());
        for (var i = 0; i < allContainers.length; i++ ) {
            var container = docker.getContainer(allContainers[i].Id);
            var info = yield container.inspect(resume());
            if (u.contains(info.Config.Env, "toothless=true")) {
                containers.push(info);
            }
        }
        callback(null, containers);

    }, function(err) {
        if (err) {
            callback(err, null);
        }
    });
}

// -------------------------------------------------------------
// Exports
// -------------------------------------------------------------
module.exports = {
    cleanUpContainers: cleanUpContainers,
    getImageEnvVars: getImageEnvVars,
    getContainerInfo: getContainerInfo,
    getToothlessImages: getToothlessImages,
    getContainerPublicPort: getContainerPublicPort,
    stopContainerAsync: stopContainerAsync,
    killContainerAsync: killContainerAsync,
    uninstallImage: uninstallImage,
    getRunningToothlessContainers: getRunningToothlessContainers,
    pullRepo: pullRepo,
    startContainer: startContainer
};