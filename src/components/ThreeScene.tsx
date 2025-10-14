import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

interface ThreeSceneProps {
  gender: string;
  onMuscleSelect: (muscle: string, label: string) => void;
  selectedMuscles: string[];
}

const linkedMuscles: Record<string, string[]> = {
  chest_upper_left: ["chest_upper_left", "chest_upper_right"],
  chest_upper_right: ["chest_upper_left", "chest_upper_right"],
};

const ThreeScene = forwardRef(({ gender, onMuscleSelect, selectedMuscles }: ThreeSceneProps, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const baseEmissiveRef = useRef(new THREE.Color(0x000000));
  const highlightColorRef = useRef(new THREE.Color(0x22c55e));
  const highlightedMeshRef = useRef<THREE.Mesh | null>(null);
  const muscleMeshMapRef = useRef<Record<string, THREE.Mesh[]>>({});
  const highlightedKeysRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Reference to the model root
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const targetYRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    rotateTo: (direction: "front" | "back" | "side") => {
      if (!modelRootRef.current) return;
      // 0 = front, Math.PI = back, Math.PI/2 = side (right), -Math.PI/2 = side (left)
      let targetY = 0;
      if (direction === "front") targetY = 0;
      else if (direction === "back") targetY = Math.PI;
      else if (direction === "side") targetY = Math.PI / 2;
      targetYRef.current = targetY;
      if (!animationFrameRef.current) animateRotation();
    },
  }));

  function animateRotation() {
    if (!modelRootRef.current || targetYRef.current === null) {
      animationFrameRef.current = null;
      return;
    }
    const currentY = modelRootRef.current.rotation.y;
    const targetY = targetYRef.current;
    let delta = targetY - currentY;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) < 0.01) {
      modelRootRef.current.rotation.y = targetY;
      targetYRef.current = null;
      animationFrameRef.current = null;
      return;
    }
    modelRootRef.current.rotation.y += delta * 0.15;
    animationFrameRef.current = requestAnimationFrame(animateRotation);
  }

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
    let mixer: THREE.AnimationMixer | null = null;
    const highlightColor = highlightColorRef.current;
    const baseEmissive = baseEmissiveRef.current;




    const meshNameOverrides: Record<string, { key: string; label: string; group?: string }> = {
      //Upper Body
      neck: { key: "neck", label: "Neck" },
      //Shoulder
      upper_traps: { key: "upper_traps", label: "Upper Traps", group: "Shoulder" },
      side_delts: { key: "side_delts", label: "Side Delts", group: "Shoulder" },
      side_delps: { key: "front_delts", label: "Front Delts", group: "Shoulder" },
      rear_delts: { key: "rear_delts", label: "Rear Delts", group: "Shoulder" },

      //Chest
      lower_chest: { key: "chest_lower", label: "Lower Chest", group: "Chest" },
      middle_chest: { key: "chest_middle", label: "Middle Chest", group: "Chest" },
      upper_chest_left: { key: "chest_upper_left", label: "Upper Chest (Left)", group: "Chest" },
      upper_chest_right: { key: "chest_upper_right", label: "Upper Chest (Right)", group: "Chest" },

      //Mid section
      abs: { key: "abs", label: "Abs", group: "Core" },
      obliques: { key: "obliques", label: "Obliques", group: "Core" },
      serratus_anterior: { key: "serratus_anterior", label: "Serratus anterior", group: "Core" },

      //Arms
      biceps: { key: "biceps", label: "Biceps", group: "Arms" },
      triceps001: { key: "triceps", label: "Triceps", group: "Arms" },
      forearms: { key: "forearms", label: "Forearms", group: "Arms" },

      //Back
      mid_traps: { key: "mid_traps", label: "Mid Traps", group: "Back" },
      lower_traps: { key: "lower_traps", label: "Lower Traps", group: "Back" },
      teres_major: { key: "teres_major", label: "Teres Major", group: "Back" },
      infraspinatus: { key: "infraspinatus", label: "infraspinatus", group: "Back" },
      lats: { key: "lats", label: "Lats", group: "Back" },
      lower_back: { key: "lower_back", label: "Lower Back", group: "Back" },
      //Lower Body
      glutes: { key: "glutes", label: "Glutes" },
      adductors: { key: "adductors", label: "Adductors" },
      quads: { key: "quads", label: "Quads" },
      hamstrings: { key: "hamstrings", label: "Hamstrings" },
      shin: { key: "shin", label: "Shin" },
      calves: { key: "calves", label: "Calves" },

    };

    // Place this outside your component
    const groupToMuscles: Record<string, string[]> = {};
    Object.entries(meshNameOverrides).forEach(([meshKey, { group }]) => {
      if (group) {
        if (!groupToMuscles[group]) groupToMuscles[group] = [];
        groupToMuscles[group].push(meshKey);
      }
    });

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

    // Detect WebAssembly support
    const isWasmSupported = (() => {
      try {
        if (typeof WebAssembly === "object"
          && typeof WebAssembly.instantiate === "function") {
          const module = new WebAssembly.Module(
            Uint8Array.of(
              0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
            )
          );
          if (module instanceof WebAssembly.Module)
            return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
        }
      } catch (e) { }
      return false;
    })();

    if (!isWasmSupported) {
      dracoLoader.setDecoderConfig({ type: "js" });
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    }

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // Loader setup
    setLoading(true);

    loader.load(
      "/3d-models/musculature.glb",
      (gltf) => {
        modelRootRef.current = gltf.scene;
        let modelRoot = gltf.scene;
        modelRoot.position.y = 10;
        modelRoot.rotation.set(-0.5, 0, 0);

        modelRoot.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            console.log("Mesh name:", mesh.name); // <-- Add this line
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            const override = meshNameOverrides[mesh.name];
            mesh.userData.interactive = !!override; // Only meshes in meshNameOverrides are interactive
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

        console.log("GLTF Animations:", gltf.animations); // <-- Add this line

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(modelRoot);
          mixer.clipAction(gltf.animations[0]).play();
        }
        scene.add(modelRoot);
        setLoading(false); // Hide loader when model is loaded
      },
      undefined,
      (error) => {
        console.error("Failed to load GLTF", error);
        setLoading(false); // Hide loader on error
      }
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
        if (
          clickedPart instanceof THREE.Mesh &&
          clickedPart.userData.interactive
        ) {
          const { muscleKey, muscleLabel } = clickedPart.userData;
          // Special logic for upper chest sides
          if (muscleKey === "chest_upper_left" || muscleKey === "chest_upper_right") {
            onMuscleSelect("chest_upper_left", "Upper Chest");
            highlightMuscle("chest_upper_left");
          } else {
            onMuscleSelect(muscleKey, muscleLabel);
            highlightMuscle(muscleKey);
          }
        }
      }
    };

    containerRef.current.addEventListener("click", onMouseClick);

    // Mouse drag for rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    // --- Mouse events (already present) ---
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
        rotateModel(deltaMove.x, deltaMove.y);
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };

    // --- Touch events for mobile ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        const deltaMove = {
          x: e.touches[0].clientX - previousMousePosition.x,
          y: e.touches[0].clientY - previousMousePosition.y,
        };
        rotateModel(deltaMove.x, deltaMove.y);
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };
    const onTouchEnd = () => {
      isDragging = false;
    };

    // --- Helper for rotation ---
    function rotateModel(deltaX: number, deltaY: number) {
      if (!modelRootRef.current) return;
      modelRootRef.current.rotation.y += deltaX * 0.01;
      modelRootRef.current.rotation.x = THREE.MathUtils.clamp(
        modelRootRef.current.rotation.x + deltaY * 0.005,
        -Math.PI / 6,
        Math.PI / 6
      );
      modelRootRef.current.rotation.z = 0;
    }

    // --- Add event listeners ---
    containerRef.current.addEventListener("mousedown", onMouseDown);
    containerRef.current.addEventListener("mousemove", onMouseMove);
    containerRef.current.addEventListener("mouseup", onMouseUp);

    containerRef.current.addEventListener("touchstart", onTouchStart, { passive: false });
    containerRef.current.addEventListener("touchmove", onTouchMove, { passive: false });
    containerRef.current.addEventListener("touchend", onTouchEnd, { passive: false });

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      if (mixer) mixer.update(clock.getDelta());
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
      if (modelRootRef.current) {
        modelRootRef.current.traverse((child) => {
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
      mixer = null;

      containerRef.current?.removeEventListener("mousedown", onMouseDown);
      containerRef.current?.removeEventListener("mousemove", onMouseMove);
      containerRef.current?.removeEventListener("mouseup", onMouseUp);

      containerRef.current?.removeEventListener("touchstart", onTouchStart);
      containerRef.current?.removeEventListener("touchmove", onTouchMove);
      containerRef.current?.removeEventListener("touchend", onTouchEnd);
    };
  }, [gender]);

  useEffect(() => {
    if (!selectedMuscles || selectedMuscles.length === 0) return;
    highlightMuscles(selectedMuscles);
  }, [selectedMuscles]);

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

  const highlightMuscles = (muscleKeys: string[]) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const baseEmissive = baseEmissiveRef.current;
    const highlightColor = highlightColorRef.current;
    const muscleMeshMap = muscleMeshMapRef.current;

    // Reset previous highlights
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

    // Highlight new keys
    muscleKeys.forEach((key) => {
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

    highlightedKeysRef.current = muscleKeys;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] overflow-hidden"
      style={{ display: "flex", alignItems: "stretch", justifyContent: "stretch" }}
    >
      {loading && (
        <div
          className="absolute inset-0 z-10"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ transform: "translateY(8%)" }}>
            <svg className="animate-spin h-10 w-10 text-accent" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="ml-4 text-accent-foreground text-lg font-medium">
              Loading 3D Model...
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

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

