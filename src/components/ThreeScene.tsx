import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface ThreeSceneProps {
  gender: string;
  onMuscleSelect: (muscle: string) => void;
}

const linkedMuscles: Record<string, string[]> = {
  chest_upper_left: ["chest_upper_left", "chest_upper_right"],
  chest_upper_right: ["chest_upper_left", "chest_upper_right"],
};

const ThreeScene = ({ gender, onMuscleSelect }: ThreeSceneProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const baseEmissiveRef = useRef(new THREE.Color(0x000000));
  const highlightColorRef = useRef(new THREE.Color(0x22c55e));
  const highlightedMeshRef = useRef<THREE.Mesh | null>(null);
  const muscleMeshMapRef = useRef<Record<string, THREE.Mesh[]>>({});
  const highlightedKeysRef = useRef<string[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      40,
      9000
    );
    camera.position.set(0, 40, 70);
    camera.lookAt(new THREE.Vector3(0, 1, 0));
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Load 3D model
    let modelRoot: THREE.Object3D | null = null;
    const highlightColor = highlightColorRef.current;
    const baseEmissive = baseEmissiveRef.current;

    const meshNameOverrides: Record<string, { key: string; label: string }> = {
      lower_chest: { key: "chest_lower", label: "Lower Chest" },
      middle_chest: { key: "chest_middle", label: "Middle Chest" },
      upper_chest_left: { key: "chest_upper_left", label: "Upper Chest (Left)" },
      upper_chest_right: { key: "chest_upper_right", label: "Upper Chest (Right)" },
      Object_23: { key: "chest_full", label: "Chest" },
      Object_5: { key: "shoulders", label: "Shoulders" },
      Object_13: { key: "back", label: "Back" },
    };

    const loader = new GLTFLoader();
    loader.load(
      "/3d-models/edited-gltf.gltf",
      (gltf) => {
        modelRoot = gltf.scene;
        modelRoot.position.y = 10;
        modelRoot.rotation.set(-0.5, 0, 0); // lock base orientation
        modelRoot.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            const override = meshNameOverrides[mesh.name];
            const muscleLabel = override?.label ?? prettify(mesh.name);
            const muscleKey =
              override?.key ?? normaliseKey(muscleLabel) ?? "unknown";

            const clonedMaterials = materials.map((mat) => {
              const cloned = mat.clone();
              if ("emissive" in cloned && cloned.emissive instanceof THREE.Color) {
                cloned.emissive.copy(baseEmissive);
              }
              return cloned;
            });

            mesh.userData.muscleKey = muscleKey;
            mesh.userData.muscleLabel = muscleLabel;
            mesh.userData.originalMaterials = clonedMaterials;
            mesh.material = Array.isArray(mesh.material)
              ? clonedMaterials
              : clonedMaterials[0];
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (!muscleMeshMapRef.current[muscleKey]) {
              muscleMeshMapRef.current[muscleKey] = [];
            }
            muscleMeshMapRef.current[muscleKey].push(mesh);
          }
        });
        scene.add(modelRoot);
      },
      undefined,
      (error) => console.error("Failed to load GLTF", error)
    );

    // Mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const clickedPart = intersects[0].object;
        if (clickedPart instanceof THREE.Mesh) {
          const { muscleKey, muscleLabel } = clickedPart.userData;
          if (muscleKey) {
            onMuscleSelect(muscleKey);
            highlightMuscle(muscleKey);
          } else if (muscleLabel) {
            const normalised = normaliseKey(muscleLabel);
            onMuscleSelect(normalised);
            highlightMuscle(normalised);
          }
        }
      }
    };

    containerRef.current.addEventListener("click", onMouseClick);

    // Mouse drag for rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaMove = {
          x: e.clientX - previousMousePosition.x,
          y: e.clientY - previousMousePosition.y,
        };

        const rotateModel = (deltaX: number, deltaY: number) => {
          if (!modelRoot) return;
          modelRoot.rotation.y += deltaX * 0.01;
          modelRoot.rotation.x = THREE.MathUtils.clamp(
            modelRoot.rotation.x + deltaY * 0.005,
            -Math.PI / 6,
            Math.PI / 6
          );
          modelRoot.rotation.z = 0;
        };

        rotateModel(deltaMove.x, deltaMove.y);

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    containerRef.current.addEventListener("mousedown", onMouseDown);
    containerRef.current.addEventListener("mousemove", onMouseMove);
    containerRef.current.addEventListener("mouseup", onMouseUp);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const onResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect =
        containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      if (modelRoot) {
        modelRoot.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const materialArray = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            materialArray.forEach((mat) => mat.dispose?.());
            (mesh.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
          }
        });
      }
      scene.clear();
      highlightedMeshRef.current = null;
      window.removeEventListener("resize", onResize);
      highlightedKeysRef.current = [];
      muscleMeshMapRef.current = {};
    };
  }, [gender]);

  const highlightMuscle = (muscleKey: string) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const baseEmissive = baseEmissiveRef.current;
    const highlightColor = highlightColorRef.current;
    const muscleMeshMap = muscleMeshMapRef.current;

    const keysToReset = highlightedKeysRef.current;
    keysToReset.forEach((key) => {
      const meshes = muscleMeshMap[key] || [];
      meshes.forEach((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if ("emissive" in mat && mat.emissive && typeof (mat.emissive as THREE.Color).copy === "function") {
            (mat.emissive as THREE.Color).copy(baseEmissive);
          }
        });
      });
    });

    const keysToHighlight = linkedMuscles[muscleKey] ?? [muscleKey];
    keysToHighlight.forEach((key) => {
      const meshes = muscleMeshMap[key] || [];
      meshes.forEach((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if ("emissive" in mat && mat.emissive && typeof (mat.emissive as THREE.Color).copy === "function") {
            (mat.emissive as THREE.Color).copy(highlightColor);
          }
        });
      });
    });

    highlightedKeysRef.current = keysToHighlight;
  };

  return <div ref={containerRef} className="w-full h-full" />;
};

export default ThreeScene;
function prettify(name = ""): string {
  return name
    .replace(/[_\-]+/g, " ")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function normaliseKey(name = ""): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "unknown";
}

