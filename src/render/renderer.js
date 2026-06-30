// Renderer setup and scene initialization
import * as THREE from 'three';

export class GameRenderer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.lights = {};
        
        this.init();
    }

    init() {
        // 1. Create Scene with Sky Color
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue
        
        // Add beautiful atmosphere fog
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.02);

        // 2. Create Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );

        // 3. Create WebGL Renderer with mobile optimizations
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 950;
        this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = !isMobile;
        if (!isMobile) {
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // Append renderer to body
        document.body.appendChild(this.renderer.domElement);

        // 4. Setup lighting (Ambient + Directional with shadows)
        this.setupLights();

        // 5. Setup Window Resize Handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    setupLights() {
        // Ambient Light - soft environment fill
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.lights.ambient);

        // Directional Light - simulates the Sun
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 40, 20);
        
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 950;
        dirLight.castShadow = !isMobile;
        
        if (!isMobile) {
            // Optimize shadow maps for voxel grid performance
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 100;
            
            const d = 30; // Orthographic coverage
            dirLight.shadow.camera.left = -d;
            dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d;
            dirLight.shadow.camera.bottom = -d;
            dirLight.shadow.bias = -0.0005;
        }

        this.scene.add(dirLight);
        this.lights.directional = dirLight;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
