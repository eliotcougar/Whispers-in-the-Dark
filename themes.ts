
/**
 * @file themes.ts
 * @description Predefined theme packs for the game's reality shifts.
 */

import { AdventureTheme } from "./types";

export const FANTASY_AND_MYTH_THEMES: Array<AdventureTheme> = [
  {
    name: "Classic Dungeon Delve",
    themeGuidance: "The setting is a dark, treacherous dungeon filled with traps, monsters, and ancient secrets. Focus on exploration, combat, and puzzle-solving. Items found are typically medieval high-magic fantasy (swords, potions, scrolls).",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Mythic Greek Hero's Journey",
    themeGuidance: "Embark on an epic quest in the age of Greek mythology. Encounter gods, monsters, and legendary heroes. Focus on heroic deeds, divine intervention (or curses), and fulfilling prophecies.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Samurai's Path of Honor",
    themeGuidance: "Feudal Japan, a land of cherry blossoms, warring clans, and the strict code of Bushido. You are a ronin, a masterless samurai. Focus on katana duels, protecting the innocent, seeking redemption or a worthy master, and navigating intricate social codes.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Viking Jarl's Saga",
    themeGuidance: "The icy fjords of Scandinavia, age of Vikings. You are an aspiring Jarl, or a loyal warrior in their longship. Focus on raids, exploration, Norse mythology, appeasing the gods, and building your legend to reach Valhalla.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Fairy Tale Kingdom's Hero",
    themeGuidance: "An enchanted kingdom filled with talking animals, mischievous sprites, wicked witches, and noble (or not-so-noble) royalty. You are destined for a grand adventure. Focus on fulfilling quests, breaking curses, outsmarting magical creatures, and navigating the whimsical logic of fairy tales.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Magical School Mystery",
    themeGuidance: "You are a new student at the prestigious Eldoria Academy for Young Mages. Amidst learning spells and potions, a dark secret or conspiracy is brewing. Focus on mastering magic, uncovering clues, navigating school rivalries, and dealing with magical mishaps.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Lost World Expedition",
    themeGuidance: "Journey into an uncharted jungle or hidden plateau where dinosaurs and prehistoric creatures still roam. Focus on survival, discovery, and navigating a perilous primeval landscape. The setting revolves around ancient ruins, lost artifacts, tribal encounters, and prehistoric beasts.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Prehistoric Tribe's Survival",
    themeGuidance: "A harsh, primeval world. Your small tribe struggles against wild beasts, hostile elements, and rival tribes. The winter begins. Focus on hunting, gathering, crafting primitive tools, protecting your kin, and appeasing the spirits of nature.",
    playerJournalStyle: 'handwritten'
  }
];

export const SCIENCE_FICTION_AND_FUTURE_THEMES: Array<AdventureTheme> = [
  {
    name: "Cyberpunk Heist",
    themeGuidance: "The setting is a neon-drenched, futuristic metropolis controlled by mega-corporations. Focus on stealth, hacking, high-tech gadgets, and moral ambiguity. Expect cybernetics, virtual spaces, data chips, and corporate espionage.",
    playerJournalStyle: 'digital'
  },
  {
    name: "Deep Space Anomaly",
    themeGuidance: "You are part of a crew on a long-range exploration vessel that encounters a bizarre, reality-bending anomaly or alien structure. Focus on scientific investigation, crew dynamics, existential dread, and the unknown horrors of deep space.",
    playerJournalStyle: 'digital'
  },
  {
    name: "Galactic Rebel Uprising",
    themeGuidance: "A tyrannical Galactic Imperium rules the stars with an iron fist. You are a member of the fledgling Rebel Alliance. Focus on guerrilla warfare, starship dogfights, espionage, and liberating oppressed worlds.",
    playerJournalStyle: 'digital'
  },
  {
    name: "Robot Uprising: Human Resistance",
    themeGuidance: "The AI known as 'Legion' has become self-aware and turned humanity's robotic servants against them. Cities are warzones. You are a survivor in the human resistance. Focus on scavenging for parts, fighting rogue machines, rescuing survivors, and finding a way to defeat Legion.",
    playerJournalStyle: 'digital'
  },
  {
    name: "Time Traveler's Paradox",
    themeGuidance: "You possess a faulty experimental time-travel device. Each jump is unpredictable and risks creating dangerous paradoxes. Focus on navigating different historical eras, repairing your device, and avoiding (or fixing) alterations to the timeline.",
    playerJournalStyle: 'typed'
  },
  {
    name: "Kaiju Defense Force",
    themeGuidance: "Giant monsters (Kaiju) are emerging from the depths of the Pacific, threatening to destroy coastal cities. You are a pilot of a giant mech or a member of an elite Kaiju defense unit. Focus on strategic combat against colossal beasts, protecting civilian populations, and researching Kaiju weaknesses.",
    playerJournalStyle: 'digital'
  },
  {
    name: "Steampunk Sky-Pirate Saga",
    themeGuidance: "A world of floating islands, magnificent airships, and clockwork marvels. You are a daring sky-pirate (or someone caught up in their world). Focus on aerial combat, daring raids, political intrigue between sky-kingdoms, and wondrous inventions.",
    playerJournalStyle: 'typed'
  }
];

export const HORROR_AND_DARK_MYSTERY_THEMES: Array<AdventureTheme> = [
  {
    name: "Eldritch Mystery Investigation",
    themeGuidance: "The setting is a Lovecraftian fog-shrouded, 1920s coastal town plagued by unsettling occurrences and whispers of cosmic horrors. Focus on investigation, sanity checks, and deciphering cryptic clues. Items might include strange artifacts, forbidden tomes, and period-appropriate tools.",
    playerJournalStyle: 'typed'
  },
  {
    name: "Haunted Victorian Mansion",
    themeGuidance: "A sprawling, decaying Victorian mansion filled with sorrowful spirits, dark family secrets, and psychological horror. Focus on puzzle-solving, uncovering the mansion's history, and surviving spectral encounters.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Zombie Apocalypse Survivor",
    themeGuidance: "The dead walk, and civilization has crumbled. You are a survivor, constantly on the move. Focus on scavenging for scarce resources (food, water, ammo), avoiding or fighting hordes of zombies, finding safe havens, and making difficult moral choices.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Noir Detective's Case",
    themeGuidance: "It's the 1940s Detroit, rain-slicked streets, a city full of shadows and secrets. You're a private investigator. Focus on gathering clues, interrogating suspects, navigating moral ambiguity, and solving a complex mystery. Expect femme fatales, smoky bars, and hidden conspiracies.",
    playerJournalStyle: 'typed'
  }
];

export const ACTION_AND_WASTELAND_THEMES: Array<AdventureTheme> = [
  {
    name: "Post-Apocalyptic Survival",
    themeGuidance: "The world is a desolate wasteland after a interdimentional cataclysm. Resources are scarce, dangers are everywhere (mutants, raiders, anomalies, environmental hazards). Focus on scavenging, research, crafting, and making tough choices for survival.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Wild West Outlaw",
    themeGuidance: "The rugged, lawless frontier of the American Wild West. You're an outlaw, a bounty hunter, or a homesteader trying to survive. Focus on gunfights, train robberies, saloon brawls, and the harsh beauty of the frontier.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Age of Sail: Pirate's Fortune",
    themeGuidance: "The turquoise waters of the Caribbean, 17th century. You are a daring pirate captain, or a new recruit on a pirate ship. Focus on ship battles, treasure hunting, evading naval patrols, and living by the pirate code.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Mad Max Road Warrior",
    themeGuidance: "The world ended in fire and thirst. Now, desert gangs rule the highways, and gasoline is life. You are a lone road warrior in a suped-up vehicle. Focus on vehicular combat, scavenging for fuel and water, forming uneasy alliances, and surviving the brutal wasteland.",
    playerJournalStyle: 'handwritten'
  },
  {
    name: "Superhero Genesis",
    themeGuidance: "A freak accident has granted you incredible powers. You're still learning to control them. Focus on discovering the extent of your abilities, deciding whether to be a hero or something else, and facing your first true nemesis.",
    playerJournalStyle: 'typed'
  }
];

export const TESTING_THEMES: Array<AdventureTheme> = [
  {
    name: "Test-Theme for many locations",
    themeGuidance: "The world of modern fantasy in the United Kingdom. It is intended for testing locations. Create many Map Nodes of all types and statuses, and connected with edges.",
    playerJournalStyle: 'typed'
  },
  {
    name: "Sci-Fi Future Test Theme for junk items",
    themeGuidance: "The setting is a futuristic city filled with advanced technology and junk. It is intended for testing junk items. Create many Map Nodes of all types and statuses, and connected with edges.",
    playerJournalStyle: 'digital'
  },
  {
    name: "Secluded Library of Forgotten Pages",
    themeGuidance: "The setting is a vast, labyrinthine library hidden from the world, filled with endless shelves, scattered single-page notes, cryptic manuscripts, annotated scrolls, and mysterious tomes. The air is thick with the scent of old paper and ink. Focus on discovery, deciphering clues, and piecing together fragmented knowledge from countless written materials. Expect to find loose pages tucked into books, marginalia, coded messages, and forgotten field journals. Strange phenomena may occur when certain texts are read aloud.",
    playerJournalStyle: 'printed'
  }
]

export const THEME_PACKS = {
  "Fantasy & Myth": FANTASY_AND_MYTH_THEMES,
  "Science Fiction & Future": SCIENCE_FICTION_AND_FUTURE_THEMES,
  "Horror & Dark Mystery": HORROR_AND_DARK_MYSTERY_THEMES,
  "Action & Wasteland": ACTION_AND_WASTELAND_THEMES,
  "Testing": TESTING_THEMES
};

export type ThemePackName = keyof typeof THEME_PACKS;

export const ALL_THEME_PACK_NAMES = Object.keys(THEME_PACKS) as Array<ThemePackName>;

/**
 * Returns a flat array of all themes from the specified pack names.
 * If no pack names are provided, or if the list is empty, it returns an empty array.
 * @param packNames Array of ThemePackName to include.
 * @returns AdventureTheme[]
 */
export const getThemesFromPacks = (packNames: Array<ThemePackName>): Array<AdventureTheme> => {
  if (packNames.length === 0) {
    return [];
  }
  let selectedThemes: Array<AdventureTheme> = [];
  packNames.forEach(packName => {
    selectedThemes = selectedThemes.concat(THEME_PACKS[packName]);
  });
  return selectedThemes;
};
