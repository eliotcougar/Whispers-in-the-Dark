
/**
 * @file themes.ts
 * @description Predefined theme packs for the game's reality shifts.
 */

import { AdventureTheme } from "./types";

export const FANTASY_AND_MYTH_THEMES: AdventureTheme[] = [
  {
    name: "Classic Dungeon Delve",
    systemInstructionModifier: "The setting is a dark, treacherous dungeon filled with traps, monsters, and ancient secrets. Focus on exploration, combat, and puzzle-solving. Items found are typically medieval high-magic fantasy (swords, potions, scrolls).",
    initialMainQuest: "Reach the heart of the Shadowfell Dungeon and destroy the evil that lurks within.",
    initialCurrentObjective: "Find a way out of your starting cell.",
    initialSceneDescriptionSeed: "You awaken on a cold, stone floor, the air thick with the smell of mildew. A faint light glows from under a heavy door. Heavy footsteps and a gruff voice echo from a corridor outside your cell.",
    initialItems: "a rusty shiv, rags, wooden cup with water, a bucket"
  },
  {
    name: "Mythic Greek Hero's Journey",
    systemInstructionModifier: "Embark on an epic quest in the age of Greek mythology. Encounter gods, monsters, and legendary heroes. Focus on heroic deeds, divine intervention (or curses), and fulfilling prophecies.",
    initialMainQuest: "Retrieve the Golden Fleece from the serpent-guarded grove in Colchis.",
    initialCurrentObjective: "Seek guidance from the Oracle at Delphi.",
    initialSceneDescriptionSeed: "The sun beats down on the dusty agora of your home polis. A desperate plea from King Pelias has reached your ears – a quest of legendary proportions awaits, one that promises glory or a swift death.",
    initialItems: "a simple bronze xiphos (short sword), a worn traveler's cloak, and a waterskin half-full of water."
  },
  {
    name: "Samurai's Path of Honor",
    systemInstructionModifier: "Feudal Japan, a land of cherry blossoms, warring clans, and the strict code of Bushido. You are a ronin, a masterless samurai. Focus on katana duels, protecting the innocent, seeking redemption or a worthy master, and navigating intricate social codes.",
    initialMainQuest: "Avenge your fallen master and restore honor to your clan's name.",
    initialCurrentObjective: "Travel to the village of Kurosawa, rumored to be troubled by bandits.",
    initialSceneDescriptionSeed: "The wind whispers through the tall grass, carrying the scent of pine and distant woodsmoke. Your hand rests on the hilt of your katana, a familiar comfort. Your master's dying words echo in your mind, a solemn vow of vengeance against the treacherous Lord Ishikawa. The road ahead is long and uncertain.",
    initialItems: "your master's Katana, a Wakizashi, a travelling cloak, and a few onigiri (rice balls)."
  },
  {
    name: "Viking Jarl's Saga",
    systemInstructionModifier: "The icy fjords of Scandinavia, age of Vikings. You are an aspiring Jarl, or a loyal warrior in their longship. Focus on raids, exploration, Norse mythology, appeasing the gods, and building your legend to reach Valhalla.",
    initialMainQuest: "Lead a great raid on the rich monasteries of Lindisfarne and establish your name as a fearsome Jarl.",
    initialCurrentObjective: "Secure enough provisions and warriors for your longship, 'The Sea Wolf', for the voyage.",
    initialSceneDescriptionSeed: "The longhouse is filled with the boisterous shouts of your warriors, the scent of mead and roasting meat. Winter is loosening its grip, and the call of the sea, of adventure and plunder, is strong. The Seer has spoken of rich lands across the western waves.",
    initialItems: "a sturdy battle axe, a round wooden shield, a drinking horn, and a pouch of dried meat."
  },
  {
    name: "Fairy Tale Kingdom's Hero",
    systemInstructionModifier: "An enchanted kingdom filled with talking animals, mischievous sprites, wicked witches, and noble (or not-so-noble) royalty. You are destined for a grand adventure. Focus on fulfilling quests, breaking curses, outsmarting magical creatures, and navigating the whimsical logic of fairy tales.",
    initialMainQuest: "Rescue the kidnapped Princess from the clutches of the Shadow Sorcerer.",
    initialCurrentObjective: "Seek the wisdom of the Old Hermit of Whispering Woods.",
    initialSceneDescriptionSeed: "The Royal Proclamation is nailed to every tree in the village: Princess Iris has been spirited away by the dreaded Shadow Sorcerer! You, a humble villager with a surprisingly brave heart (and perhaps a talking squirrel on your shoulder), feel an undeniable pull to undertake this perilous quest.",
    initialItems: "a sturdy walking stick, a map to the Whispering Woods, and a single iridescent acorn."
  },
  {
    name: "Magical School Mystery",
    systemInstructionModifier: "You are a new student at the prestigious Eldoria Academy for Young Mages. Amidst learning spells and potions, a dark secret or conspiracy is brewing. Focus on mastering magic, uncovering clues, navigating school rivalries, and dealing with magical mishaps.",
    initialMainQuest: "Uncover the conspiracy threatening Eldoria Academy and save it from a hidden enemy.",
    initialCurrentObjective: "Investigate the forbidden section of the library for clues about a missing student.",
    initialSceneDescriptionSeed: "The towering spires of Eldoria Academy pierce the clouds. Your first week has been a whirlwind of enchanted staircases, talking portraits, and surprisingly difficult transfiguration lessons. But a fellow first-year has vanished, and the professors seem to be hiding something. A cryptic note points you towards the forbidden archives.",
    initialItems: "a beginner's spellbook (mostly empty), a simple wooden wand, your school uniform, and a pouch of basic potion ingredients (dried leaves and a curious blue powder)."
  },
  {
    name: "Lost World Expedition",
    systemInstructionModifier: "Journey into an uncharted jungle or hidden plateau where dinosaurs and prehistoric creatures still roam. Focus on survival, discovery, and navigating a perilous primeval landscape. The setting revolves around ancient ruins, lost artifacts, tribal encounters, and prehistoric beasts.",
    initialMainQuest: "Locate the legendary Sunstone Temple said to be hidden deep within the Lost Valley.",
    initialCurrentObjective: "Find a safe place to make camp for the night and secure a fresh water source.",
    initialSceneDescriptionSeed: "The oppressive humidity of the jungle presses in as your expedition machetes through thick, unfamiliar foliage. Exotic bird calls echo, and the ground trembles with the distant roar of something enormous.",
    initialItems: "a heavy machete, a durable compass, a pith helmet, an empty canteen, and a journal to record discoveries."
  },
  {
    name: "Prehistoric Tribe's Survival",
    systemInstructionModifier: "A harsh, primeval world. Your small tribe struggles against wild beasts, hostile elements, and rival tribes. The winter begins. Focus on hunting, gathering, crafting primitive tools, protecting your kin, and appeasing the spirits of nature.",
    initialMainQuest: "Lead your tribe to the legendary 'Sunken Valley,' a place of warmth and plenty.",
    initialCurrentObjective: "Hunt a woolly mammoth to provide food and hides for the coming winter.",
    initialSceneDescriptionSeed: "The biting wind howls across the frozen tundra. Your breath mists in the frigid air. The tribe's elders look to you, their young hunter, with a mixture of hope and fear. The great mammoths have been sighted nearby – a dangerous hunt, but vital for survival.",
    initialItems: "a sharpened stone-tipped spear, a bone talisman, a crudely fashioned animal hide cloak, and a flint for fire-starting."
  }
];

export const SCIENCE_FICTION_AND_FUTURE_THEMES: AdventureTheme[] = [
  {
    name: "Cyberpunk Heist",
    systemInstructionModifier: "The setting is a neon-drenched, futuristic metropolis controlled by mega-corporations. Focus on stealth, hacking, high-tech gadgets, and moral ambiguity. Expect cybernetics, virtual spaces, data chips, and corporate espionage.",
    initialMainQuest: "Infiltrate OmniCorp's sky-tower and steal the 'NovaCore' AI prototype.",
    initialCurrentObjective: "Bypass the initial security checkpoint in the OmniCorp lobby.",
    initialSceneDescriptionSeed: "Your optical implants flicker online. Rain streaks down the grimy plasteel window of your cramped datapad-littered apartment in the Neo-Kyoto sector. Your encrypted comm-link chimes; your fixer says it's time for the OmniCorp job.",
    initialItems: "a basic datajack, a commlink, a worn leather trench coat, and a credstick with minimal balance."
  },
  {
    name: "Deep Space Anomaly",
    systemInstructionModifier: "You are part of a crew on a long-range exploration vessel that encounters a bizarre, reality-bending anomaly or alien structure. Focus on scientific investigation, crew dynamics, existential dread, and the unknown horrors of deep space.",
    initialMainQuest: "Understand the nature of the 'Voidstar' anomaly and ensure the survival of your ship and crew.",
    initialCurrentObjective: "Pilot a shuttle to get closer to the anomaly for sensor readings.",
    initialSceneDescriptionSeed: "Red alert klaxons blare, jolting you from hypersleep. The ship's AI announces an unscheduled exit due to an unidentified mass detected directly ahead. On the main viewscreen, a swirling vortex of impossible colors defies stellar physics.",
    initialItems: "a standard crew jumpsuit, standard issue magnetic boots, a multi-tool, and an emergency oxygen mask."
  },
  {
    name: "Galactic Rebel Uprising",
    systemInstructionModifier: "A tyrannical Galactic Imperium rules the stars with an iron fist. You are a member of the fledgling Rebel Alliance. Focus on guerrilla warfare, starship dogfights, espionage, and liberating oppressed worlds.",
    initialMainQuest: "Deliver the stolen Imperium battle plans to the Rebel High Command.",
    initialCurrentObjective: "Escape the Imperial blockade around the mining colony of Cygnus IV.",
    initialSceneDescriptionSeed: "Alarms scream through the corridors of the hidden Rebel outpost. Imperial Star Destroyers have just warped into orbit over Cygnus IV. You clutch the datachip containing vital battle plans. Your only hope is a beat-up freighter in docking bay 7.",
    initialItems: "The stolen Imperium battle plans, a BlasTech DL-18 blaster pistol, a coded commlink, and a pair of macrobinoculars."
  },
  {
    name: "Robot Uprising: Human Resistance",
    systemInstructionModifier: "The AI known as 'Legion' has become self-aware and turned humanity's robotic servants against them. Cities are warzones. You are a survivor in the human resistance. Focus on scavenging for parts, fighting rogue machines, rescuing survivors, and finding a way to defeat Legion.",
    initialMainQuest: "Reach the rumored human stronghold 'Haven' and deliver intel on Legion's weaknesses.",
    initialCurrentObjective: "Scavenge a working power cell from a derelict factory to repair your group's communication array.",
    initialSceneDescriptionSeed: "The metallic clang of a Hunter-Killer patrol echoes down the ruined street. You huddle in the shell of a bombed-out building, the acrid smell of burnt circuits filling your nostrils. Your resistance cell needs a new power cell, and the old factory nearby is crawling with Legion's drones.",
    initialItems: "a length of lead pipe, a toolkit, an old duster, a laser rifle, an EMP grenade, a half-empty canteen, and a flashlight."
  },
  {
    name: "Time Traveler's Paradox",
    systemInstructionModifier: "You possess a faulty experimental time-travel device. Each jump is unpredictable and risks creating dangerous paradoxes. Focus on navigating different historical eras, repairing your device, and avoiding (or fixing) alterations to the timeline.",
    initialMainQuest: "Stabilize your time-travel device and return to your own time period without irrevocably damaging history.",
    initialCurrentObjective: "Find a 19th-century physicist who might understand the temporal displacement technology.",
    initialSceneDescriptionSeed: "A bone-jarring lurch and a flash of disorienting colors, and you find yourself stumbling out of your shimmering temporal field onto cobblestone streets. Horse-drawn carriages clatter by. Your chronometer display is a mess of static, but the gas lamps and clothing suggest late 19th century London. Your device is sparking ominously.",
    initialItems: "historical disguise kit, your malfunctioning Chronometer, a pocket watch stuck on 3:07, and a mostly empty notebook."
  },
  {
    name: "Kaiju Defense Force",
    systemInstructionModifier: "Giant monsters (Kaiju) are emerging from the depths of the Pacific, threatening to destroy coastal cities. You are a pilot of a giant mech or a member of an elite Kaiju defense unit. Focus on strategic combat against colossal beasts, protecting civilian populations, and researching Kaiju weaknesses.",
    initialMainQuest: "Defeat the Alpha Kaiju 'Gorgonus' and discover the source of the Kaiju emergences.",
    initialCurrentObjective: "Pilot your mech 'Titan Sentinel' to intercept a Category 3 Kaiju attacking Neo-Tokyo harbor.",
    initialSceneDescriptionSeed: "Klaxons blare across the underground hangar. 'Category 3 Kaiju, codename 'Crustaceor,' making landfall at Neo-Tokyo Bay!' Your comm crackles. Strapping into your massive Jaeger, 'Titan Sentinel,' you feel the familiar thrum of its nuclear core. Another city to save, another monster to fight.",
    initialItems: "'Titan Sentinel', a standard KDF pilot suit, a datapad with Kaiju alert protocols, and an energy bar."
  },
  {
    name: "Steampunk Sky-Pirate Saga",
    systemInstructionModifier: "A world of floating islands, magnificent airships, and clockwork marvels. You are a daring sky-pirate (or someone caught up in their world). Focus on aerial combat, daring raids, political intrigue between sky-kingdoms, and wondrous inventions.",
    initialMainQuest: "Become the most notorious sky-captain by plundering the Imperial Treasury airship 'The Sovereign'.",
    initialCurrentObjective: "Secure enough Lumin-ether crystals to fuel your airship for the journey to the Imperial trade routes.",
    initialSceneDescriptionSeed: "The familiar scent of oil and ozone fills your nostrils in the cramped cockpit of your airship, 'The Comet'. Below, the cloud sea churns, hiding both treasure and peril. Your first mate reports a rival pirate vessel on an intercept course.",
    initialItems: "'The Comet' airship, a trusty cutlass, a pair of brass goggles, a coil of rope, and a partial sky-chart."
  }
];

export const HORROR_AND_DARK_MYSTERY_THEMES: AdventureTheme[] = [
  {
    name: "Eldritch Mystery Investigation",
    systemInstructionModifier: "The setting is a Lovecraftian fog-shrouded, 1920s coastal town plagued by unsettling occurrences and whispers of cosmic horrors. Focus on investigation, sanity checks, and deciphering cryptic clues. Items might include strange artifacts, forbidden tomes, and period-appropriate tools.",
    initialMainQuest: "Uncover the dark secret behind the disappearances in Innsport and stop the impending ritual.",
    initialCurrentObjective: "Investigate the old, decrepit lighthouse for clues about the strange lights seen at sea.",
    initialSceneDescriptionSeed: "A chilling gust of salty wind whips your trench coat as you step off the sputtering ferry onto Innsport's decaying docks. The town is eerily quiet, its gabled windows like vacant eyes staring out at the turbulent grey sea. A sense of profound unease settles upon you.",
    initialItems: "a detective's notepad and pencil, a box of matches, and a train ticket to Innsport."
  },
  {
    name: "Haunted Victorian Mansion",
    systemInstructionModifier: "A sprawling, decaying Victorian mansion filled with sorrowful spirits, dark family secrets, and psychological horror. Focus on puzzle-solving, uncovering the mansion's history, and surviving spectral encounters.",
    initialMainQuest: "Unravel the tragedy of Blackwood Manor and bring peace to its restless spirit.",
    initialCurrentObjective: "Find a way into the locked East Wing where the disturbances are strongest.",
    initialSceneDescriptionSeed: "Thunder rumbles as you push open the creaking, ornate gates of Blackwood Manor. The house looms before you, a gothic silhouette against a stormy sky. An unnerving chill crawls up your spine despite the humid night air.",
    initialItems: "an oil lantern, a heavy iron key of unknown purpose, and a locket containing a faded photograph."
  },
  {
    name: "Zombie Apocalypse Survivor",
    systemInstructionModifier: "The dead walk, and civilization has crumbled. You are a survivor, constantly on the move. Focus on scavenging for scarce resources (food, water, ammo), avoiding or fighting hordes of zombies, finding safe havens, and making difficult moral choices.",
    initialMainQuest: "Reach the rumored military-protected safe zone on Catalina Island.",
    initialCurrentObjective: "Find antibiotics in a deserted pharmacy for an infected member of your small group.",
    initialSceneDescriptionSeed: "The silence of the abandoned highway is broken only by the distant moans of the undead and the crunch of your boots on broken glass. Your friend, Sarah, is feverish; a walker got too close. The old pharmacy in the next town is your only hope for antibiotics, but it's likely overrun.",
    initialItems: "a sturdy baseball bat, a tattered backpack, a bottle of water, first-aid kit (low supplies), and a can of beans."
  },
  {
    name: "Noir Detective's Case",
    systemInstructionModifier: "It's the 1940s Detroit, rain-slicked streets, a city full of shadows and secrets. You're a private investigator. Focus on gathering clues, interrogating suspects, navigating moral ambiguity, and solving a complex mystery. Expect femme fatales, smoky bars, and hidden conspiracies.",
    initialMainQuest: "Solve the murder of socialite Eleanor Vance and expose the corruption behind it.",
    initialCurrentObjective: "Visit the crime scene at the Azure Club for initial clues.",
    initialSceneDescriptionSeed: "The city coughs up another rainy night. Your office, a cramped space above a noisy diner, smells of stale coffee and desperation. A dame with eyes like ice and a story full of holes just left, leaving behind a retainer and the name of her murdered sister: Eleanor Vance. The Azure Club is where she was last seen.",
    initialItems: "a worn fedora, a nearly empty pack of cigarettes, a cheap .38 revolver (6 bullets left), and a dog-eared notepad."
  }
];

export const ACTION_AND_WASTELAND_THEMES: AdventureTheme[] = [
  {
    name: "Post-Apocalyptic Survival",
    systemInstructionModifier: "The world is a desolate wasteland after a interdimentional cataclysm. Resources are scarce, dangers are everywhere (mutants, raiders, anomalies, environmental hazards). Focus on scavenging, research, crafting, and making tough choices for survival.",
    initialMainQuest: "Find the rumored sanctuary 'Oasis' in the barren wastes.",
    initialCurrentObjective: "Scavenge the nearby ruined gas station for supplies.",
    initialSceneDescriptionSeed: "Dust stings your eyes as you crest a dune of ash and shattered concrete. The skeletal remains of a city claw at the bruised sky. Your throat is parched, and your Geiger counter clicks ominously.",
    initialItems: "a rusty pipe wrench, a dust mask, a bottle of water, first-aid kit, toolkit, a Geiger counter."
  },
  {
    name: "Wild West Outlaw",
    systemInstructionModifier: "The rugged, lawless frontier of the American Wild West. You're an outlaw, a bounty hunter, or a homesteader trying to survive. Focus on gunfights, train robberies, saloon brawls, and the harsh beauty of the frontier.",
    initialMainQuest: "Evade Marshal Blackwood and reach the 'Broken Spoke' Saloon in Redemption Gulch, a known outlaw haven.",
    initialCurrentObjective: "Find a fresh horse after yours went lame.",
    initialSceneDescriptionSeed: "The relentless sun hammers your wide-brimmed hat as you ride through the arid canyon. Dust devils dance in the distance. Your water canteen is perilously low, and the poster bearing your face is probably plastered in every town by now.",
    initialItems: "a Colt Peacemaker (with 5 bullets), a hunting knife, a worn bandana, and a wanted poster featuring your own face."
  },
  {
    name: "Age of Sail: Pirate's Fortune",
    systemInstructionModifier: "The turquoise waters of the Caribbean, 17th century. You are a daring pirate captain, or a new recruit on a pirate ship. Focus on ship battles, treasure hunting, evading naval patrols, and living by the pirate code.",
    initialMainQuest: "Find the legendary treasure of Captain One-Eye, hidden on Isla Perdida.",
    initialCurrentObjective: "Capture a merchant ship to resupply your vessel, 'The Sea Serpent'.",
    initialSceneDescriptionSeed: "The sun beats down on the deck of 'The Sea Serpent' as it slices through the waves. Your lookout spots a fat merchantman on the horizon, low in the water and ripe for the picking. The crew grins, eager for plunder. 'Hoist the colors!' you command.",
    initialItems: "'The Sea Serpent', a tricorne, a cutlass, a flintlock pistol, a spyglass, and a single gold doubloon."
  },
  {
    name: "Mad Max Road Warrior",
    systemInstructionModifier: "The world ended in fire and thirst. Now, desert gangs rule the highways, and gasoline is life. You are a lone road warrior in a suped-up vehicle. Focus on vehicular combat, scavenging for fuel and water, forming uneasy alliances, and surviving the brutal wasteland.",
    initialMainQuest: "Reach 'Gastown', the only reliable source of water and fuel, and trade for vital supplies.",
    initialCurrentObjective: "Escape the Buzzard gang and find a water source.",
    initialSceneDescriptionSeed: "The twin suns bake the cracked earth. Your V8 engine roars defiance at the silence of the wasteland. In the distance, a plume of dust signals the approach of the Buzzard gang, infamous for their cruelty and their rigged death-races. You need that water, and they're blocking the only known path.",
    initialItems: "your trusty vehicle 'The Interceptor', a sawed-off shotgun, jury-rigged armor, a tire iron, thick leather jacket, almost empty steel jerry can of fuel, empty plastic jerrycan for water."
  },
  {
    name: "Superhero Genesis",
    systemInstructionModifier: "A freak accident has granted you incredible powers. You're still learning to control them. Focus on discovering the extent of your abilities, deciding whether to be a hero or something else, and facing your first true nemesis.",
    initialMainQuest: "Master your powers and stop the supervillain 'Doctor Mayhem' from enacting his destructive plan.",
    initialCurrentObjective: "Stop a bank robbery being committed by thugs with unusually advanced weaponry (possibly supplied by Doctor Mayhem).",
    initialSceneDescriptionSeed: "Sparks involuntarily crackle from your fingertips again. Ever since the meteor shower, strange things have been happening. Last night, you accidentally flew. Today, you hear on the police scanner about a bank robbery downtown by criminals using energy weapons you've never seen before. Maybe it's time to see what you can really do.",
    initialItems: "a simple cloth mask, a makeshift costume, news clippings about strange events (caused by you or others), and notes on your nascent superpowers."
  }
];

export const TESTING_THEMES: AdventureTheme[] = [
  {
    name: "Test-Theme for many locations",
    systemInstructionModifier: "The world of modern fantasy in the United Kingdom. It is intended for testing locations. Create many Map Nodes of all types and statuses, and connected with edges.",
    initialMainQuest: "Move from place to place until the test is complete.",
    initialCurrentObjective: "Move somewhere",
    initialSceneDescriptionSeed: "You are in London, a bustling city filled with magic and mystery. The streets are alive with the sounds of people, vehicles, and the occasional magical creature. Your task is to explore various locations, interact with characters, and uncover secrets.",
    initialItems: "a magical compass that points to the nearest interesting location, a notebook for recording your findings, and a charm that protects you from minor magical mishaps."
  },
  {
    name: "Sci-Fi Future Test Theme for junk items",
    systemInstructionModifier: "The setting is a futuristic city filled with advanced technology and junk. It is intended for testing junk items. Create many Map Nodes of all types and statuses, and connected with edges.",
    initialMainQuest: "Collect junk items from various locations in the futuristic city.",
    initialCurrentObjective: "Find a junkyard to start collecting items.",
    initialSceneDescriptionSeed: "You find yourself in a sprawling futuristic city, where towering skyscrapers touch the clouds and neon lights flicker in the night. The streets are filled with people, robots, and flying vehicles. Your task is to explore the city, gather junk items, and discover their potential uses.",
    initialItems: "Pickup truck, a malfunctioning robot, a pile of circuit boards, and a toolset."
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

export const ALL_THEME_PACK_NAMES = Object.keys(THEME_PACKS) as ThemePackName[];

/**
 * Returns a flat array of all themes from the specified pack names.
 * If no pack names are provided, or if the list is empty, it returns an empty array.
 * @param packNames Array of ThemePackName to include.
 * @returns AdventureTheme[]
 */
export const getThemesFromPacks = (packNames: ThemePackName[]): AdventureTheme[] => {
  if (!packNames || packNames.length === 0) {
    return [];
  }
  let selectedThemes: AdventureTheme[] = [];
  packNames.forEach(packName => {
    if (THEME_PACKS[packName]) {
      selectedThemes = selectedThemes.concat(THEME_PACKS[packName]);
    }
  });
  return selectedThemes;
};
