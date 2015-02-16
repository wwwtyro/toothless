var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');

var rootPath = path.join("/opt/toothless");
var sharedPath = path.join(rootPath, "shared");

// -------------------------------------------------------------
// Create rootPath, sharedPath, and repoPath if they don't exist
// -------------------------------------------------------------
function createVolume(repo) {

    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath);
    }

    if (!fs.existsSync(sharedPath)) {
        fs.mkdirSync(sharedPath);
    }

    var repoPath = getRepoPath(repo);

    if (!fs.existsSync(repoPath)) {
        fs.mkdirSync(repoPath);
    }

}

// -------------------------------------------------------------
// Remove a repoPath
// -------------------------------------------------------------
function removeVolume(repo) {

    // Make sure root and shared paths exist.
    createVolume(repo);

    var repoPath = getRepoPath(repo);

    rimraf.sync(repoPath);

}

// -------------------------------------------------------------
// Convert a repo name into a path.
// -------------------------------------------------------------
function getRepoPath(repo) {
    return repoPath = path.join(rootPath, repo.replace('/', '-').split(':')[0]);
}

// -------------------------------------------------------------
// Validate a repo path.
// -------------------------------------------------------------
function validRepoPath(repo) {
    var cp = getRepoPath(repo);
    if (cp === sharedPath || cp.indexOf('..') !== -1) {
        return false;
    }
    return true;
}

// -------------------------------------------------------------
// Exports.
// -------------------------------------------------------------
module.exports = {
    createVolume: createVolume,
    removeVolume: removeVolume,
    getRepoPath: getRepoPath,
    validRepoPath: validRepoPath,
    rootPath: rootPath,
    sharedPath: sharedPath,
};