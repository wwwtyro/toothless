window.onload = function() {

    logo("render-canvas", 64, 64);

    fetchUIData();
    setInterval(fetchUIData, 1000);

}

function fetchUIData() {
    $.getJSON('/uidata', function(data) {
        var str = "";
        data.containers.forEach(function(c) {
            str += "<tr>";
            str += "<td>" + launchLink(c.name, c.type) + "</td>";
            str += "<td class='col-action'>"; 
            str += stopContainerButton(c.id) + " ";
            str += killContainerButton(c.id);
            str += "</td>";
            str += "</tr>";
        })
        document.getElementById('container-table').innerHTML = str;
        var str = "";
        data.images.forEach(function(i) {
            str += "<tr>"
            str += "<td>" + launchLink(i.name, i.type) + "</td>"
            str += "<td class='col-action'>";
            str += uninstallImageButton(i.name);
            str += "</td>";
            str += "</tr>";
        })
        document.getElementById('image-table').innerHTML = str;
    });
}

function stopContainerButton(id) {
    return sprintf('<input class="btn btn-primary" type="button" value="Stop" onclick=stopContainer("%s")>', id);
}

function killContainerButton(id) {
    return sprintf('<input class="btn btn-danger" type="button" value="Kill" onclick=killContainer("%s")>', id);
}

function launchLink(name) {
    return sprintf('<a href="/app?repo=%s" target=_blank>%s</a>', name, name);
}

function uninstallImageButton(name) {
    return sprintf('<input class="btn btn-danger" type="button" value="Uninstall" onclick=uninstallImage("%s")>', name);
}

function stopContainer(id) {
    postJSON("/stop-container", {id: id})
}

function killContainer(id) {
    postJSON("/kill-container", {id: id})
}

function uninstallImage(repo) {
    postJSON("/uninstall-image", {repo: repo})
}

function quickLaunch() {
    var repo = document.getElementById("quick-launch-input").value;
    window.open(sprintf("http://localhost:9887/app?repo=%s", repo));
    return false;
}

function postJSON(url, data, success) {
    $.ajax({
        url:url,
        type:"POST",
        data:JSON.stringify(data),
        contentType:"application/json; charset=utf-8",
        dataType:"json",
        success: success
    });
}

