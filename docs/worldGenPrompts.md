# World Generation Prompt Sequence

This document outlines the prompts and data structures used to generate a coherent game world and backstory for the main protagonist. Each step builds on the previous one to ensure consistency.

## 1. Theme Selection

*Prompt*: "List five unique adventure themes with a short description for each."

*Processing*: Randomly select one of the themes to become `chosenTheme`.

*Data Stored*:
```ts
interface ThemeInfo {
  name: string;
  description: string;
}
const chosenTheme: ThemeInfo;
```

## 2. Character Name Tables

*Prompt*: "Produce two tables of twenty names each: one masculine, one feminine. Use diverse cultural backgrounds."

*Processing*: Parse the list into arrays and randomly pick `heroName` from the appropriate array based on player choice.

*Data Stored*:
```ts
const maleNames: Array<string>;
const femaleNames: Array<string>;
let heroName: string;
```

## 3. World Facts

*Prompt*: "Using the `systemInstructionModifier` and `initialSceneDescriptionSeed` from `chosenTheme`, expand them into a consistent world profile. Provide at least eight attributes that remain stable throughout the story. Cover geography, climate, major factions, technology or magic level, key resources, cultural customs, notable locations, and any supernatural forces."

*Data Stored*:
```ts
interface WorldFacts {
  geography: string;
  climate: string;
  technologyLevel: string;
  supernaturalElements: string;
  majorFactions: Array<string>;
  keyResources: Array<string>;
  culturalNotes: Array<string>;
  notableLocations: Array<string>;
}
const worldFacts: WorldFacts;
```

## 4. Protagonist Narrative Sheet

*Prompt*: "Using `heroName` and `chosenTheme`, create a brief character sheet including occupation, notable traits, and starting equipment."

*Data Stored*:
```ts
interface HeroSheet {
  name: string;
  occupation: string;
  traits: Array<string>;
  startingItems: Array<string>;
}
const heroSheet: HeroSheet;
```

## 5. Protagonist Backstory

*Prompt*: "Write a short backstory for `heroName` using these time markers: 5 years ago, 1 year ago, 6 months ago, 1 month ago, 1 week ago, and yesterday. Keep each segment to two sentences."

*Data Stored*:
```ts
interface HeroBackstory {
  fiveYearsAgo: string;
  oneYearAgo: string;
  sixMonthsAgo: string;
  oneMonthAgo: string;
  oneWeekAgo: string;
  yesterday: string;
}
const heroBackstory: HeroBackstory;
```

## 6. Five Act Narrative Arc

*Prompt*: "Outline a five act plot for `chosenTheme`. For each act provide a short description, a main quest objective, two side quests, and the success condition to reach the next act."

*Data Stored*:
```ts
interface ActInfo {
  description: string;
  mainQuest: string;
  sideQuests: Array<string>;
  successCondition: string;
}
const narrativeArc: Array<ActInfo>; // length 5
```

## 7. Consolidated World Data

After gathering all pieces, combine them into a single structure.

```ts
interface GameWorld {
  theme: ThemeInfo;
  world: WorldFacts;
  hero: HeroSheet;
  backstory: HeroBackstory;
  arc: Array<ActInfo>;
}
const gameWorld: GameWorld;
```

This `gameWorld` object fully describes the starting state and ongoing goals of the protagonist within the selected theme. The prompts above are designed so the output of each feeds into the next, enabling a coherent setup for a fresh adventure each time.
