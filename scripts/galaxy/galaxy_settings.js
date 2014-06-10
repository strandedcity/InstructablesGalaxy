Galaxy = window.Galaxy || {};
Galaxy.Settings = {
    width: $(document).width(),
    height: $(document).height(),
    categories: ["living","outside","workshop","food","technology","play"],
    viewThreshold: 18000,  // Instructables with fewer views than this will not appear
    maxIblesPerAuthor: 30, // Specifies number of stars in largest constellation. DOES NOT CULL DATASET!!
    cameraDefaultPosition: new THREE.Vector3(65,-935,250),
    cameraDefaultTarget: new THREE.Vector3(0,0,-60),
    cameraDefaultUp: (new THREE.Vector3(0,0.93,0.36)).normalize(),
    cameraDefaultFOV: 20
};