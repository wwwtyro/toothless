function logo(canvasid, width, height) {

    var canvas = document.getElementById(canvasid);
    if (width && height) {
        canvas.width = width;
        canvas.height = height;
    }
    var renderer = new THREE.WebGLRenderer({
        canvas:canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    var camera = new THREE.PerspectiveCamera( 75, canvas.clientWidth / canvas.clientHeight, 0.1, 100 );
    window.camera = camera;
    camera.position.set(0, 0, 1.7);

    var scene = new THREE.Scene();

    var g = new THREE.IcosahedronGeometry(1, 1);
    var m = new THREE.MeshNormalMaterial();
    var mesh = new THREE.Mesh(g, m);
    var speed = 0.1;
    mesh._rx = Math.random() * speed - speed/2;
    mesh._ry = Math.random() * speed - speed/2;
    scene.add(mesh);

    var frozen = false;

    function animate() {
        requestAnimationFrame(animate);
        if (frozen) {
            return;            
        }
        if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
            renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }
        if (Math.random() < 0.1) {
            mesh._rx = Math.random() * speed - speed/2;
            mesh._ry = Math.random() * speed - speed/2;
        }
        mesh.rotation.x += mesh._rx;
        mesh.rotation.y += mesh._ry;
        renderer.render(scene, camera);
    }

    animate();

    return function freeze(f) {
        frozen = f;
    }

}