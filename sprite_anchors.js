// Local, visually calibrated base centres in original PNG pixels.
// These are NOT recovered Unity pivots or game-coordinate corrections.
// Separate from generated alpha bounds: rebuilding art must not erase them.
export const SPRITE_GROUND_ANCHORS = {
  'castle1.png': [176,205],
  'castle3.png': [212,245],
  'castle5.png': [211,306],
  'castle6.png': [215,288],
  'castle7.png': [232,294],
  'alliance_flag.png': [62,129],
  'alliance_flag_broken.png': [62,132],
  'alliance_trap_open.png': [230,240],
  'alliance_duel.png': [247,250],
  'sprite-34272.png': [298,330],
  'mine_meat.png': [197,240],
  'mine_wood.png': [235,268],
  'mine_coal.png': [233,300],
  'mine_iron.png': [182,247],
  'building2101.png': [560,598],
  // Calibrated against the recovered ground in the same original screenshot.
  // Legacy logo transfer [667,919] put the bridge too high. The illustrated
  // capital is tall terrain, not a small castle standing at its lowest edge.
  // Display only; not an asserted native Unity pivot or changed grid position.
  'building2001-rgba-source-known.png': [596,634],
  'worldfield_tronghold_bg_001.png': [254,314],
  'worldfield_tronghold_bg_002.png': [245,311],
  'worldfield_tronghold_bg_003.png': [271,326],
  'worldfield_tronghold_bg_004.png': [250,310],
  'worldfield_tronghold_bg_006.png': [252,316],
  'worldfield_tronghold_bg_007.png': [262,320],
  'worldfield_tronghold_bg_008.png': [256,321],
  'worldfield_allianceterritory_001.png': [114,149],
  'worldfield_allianceterritory_002.png': [114,149],
  'worldfield_allianceterritory_003.png': [114,149],
  'worldfield_allianceterritory_004.png': [114,149],
  'worldfield_allianceterritory_018.png': [115,162],
  'worldfield_allianceterritory_019.png': [115,162],
  'worldfield_allianceterritory_020.png': [115,164],
  'worldfield_allianceterritory_021.png': [115,167],
  'worldfield_allianceterritory_022.png': [114,166],
  'worldfield_allianceterritory_024.png': [120,156],
  'worldfield_allianceterritory_025.png': [115,157],
  'worldfield_allianceterritory_026.png': [117,157],
  'worldfield_allianceterritory_027.png': [120,159]
};

// Small, image-only upward adjustment in source pixels. The ground marker
// stays at the projected coordinate; scaling/hover/picking share this offset.
export const SPRITE_DISPLAY_LIFTS = {'alliance_trap_open.png': 16};
