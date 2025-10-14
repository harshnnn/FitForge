// Custom hook for muscle data, mappings, and prettify
type MeshNameOverride = { label: string; group?: string };
const meshNameOverrides: Record<string, MeshNameOverride> = {
  neck: { label: "Neck" },
  upper_traps: { label: "Upper traps", group: "Shoulder" },
  side_delts: { label: "Side Delts", group: "Shoulder" },
  front_delts: { label: "Front Delts", group: "Shoulder" },
  rear_delts: { label: "Rear Delts", group: "Shoulder" },
  chest_lower: { label: "Lower Chest", group: "Chest" },
  chest_middle: { label: "Middle Chest", group: "Chest" },
  chest_upper_left: { label: "Upper Chest (Left)", group: "Chest" },
  chest_upper_right: { label: "Upper Chest (Right)", group: "Chest" },
  abs: { label: "Abs", group: "Core" },
  obliques: { label: "Obliques", group: "Core" },
  serratus_anterior: { label: "Serratus anterior", group: "Core" },
  biceps: { label: "Biceps", group: "Arms" },
  triceps: { label: "Triceps", group: "Arms" },
  forearms: { label: "Forearms", group: "Arms" },
  mid_traps: { label: "Mid Traps", group: "Back" },
  lower_traps: { label: "Lower Traps", group: "Back" },
  teres_major: { label: "Teres Major", group: "Back" },
  infraspinatus: { label: "Infraspinatus", group: "Back" },
  lats: { label: "Lats", group: "Back" },
  lower_back: { label: "Lower Back", group: "Back" },
  glutes: { label: "Glutes", group: "Legs" },
  adductors: { label: "Adductors", group: "Legs" },
  quads: { label: "Quads", group: "Legs" },
  hamstrings: { label: "Hamstrings", group: "Legs" },
  shin: { label: "Shin", group: "Legs" },
  calves: { label: "Calves", group: "Legs" },
};
export function useMuscleData() {
  const groupToMuscles: Record<string, string[]> = {};
  Object.entries(meshNameOverrides).forEach(([meshKey, value]) => {
    const group = value.group;
    if (group) {
      if (!groupToMuscles[group]) groupToMuscles[group] = [];
      groupToMuscles[group].push(meshKey);
    }
  });
  const linkedMuscles: Record<string, string[]> = {
    chest_upper_left: ["chest_upper_left", "chest_upper_right"],
    chest_upper_right: ["chest_upper_left", "chest_upper_right"],
  };
  const backFacingMuscles = [
    "triceps",
    "rear_delts","upper_traps","mid_traps", "lower_traps", "teres_major", "infraspinatus", "lats", "lower_back",
    "glutes", "hamstrings", "calves"
  ];
  const sideFacingMuscles = [
    "side_delts", "serratus_anterior"
  ];
  function prettify(name = ""): string {
    return name
      .replace(/[_\-]+/g, " ")
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return {
    meshNameOverrides,
    groupToMuscles,
    linkedMuscles,
    backFacingMuscles,
    sideFacingMuscles,
    prettify,
  };
}
