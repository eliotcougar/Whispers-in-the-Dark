IDEAS:

Using items is a mess, they have their own states.
  - Isolate scene actions and item actions. Up to three item actions per turn, using an auxiliary model to generate outcomes, then the next scene generates automatically.
  - Make the status a free-form string. May be more versatile than Active/Inactive.

v1.4. Ink and Quill update
  + Notebook item type with real text notes inside.
  + Notebook/Journal as a core feature of the game instead of an item that can be lost.
  + Book item type with real chapters inside.
  + Page item type as a single page book subtype.
  + Fact list, storing random static facts. Loremaster AI that extracts small immutable facts.
  + Librarian AI: Selects relevant facts from the fact list before each turn.
  + Inspect action on written materials to inject contents into Storyteller AI and Loremaster AI.
  + Inspecting your own journal is used to potentially inject new lore.
  - Calm and Action global states to define when the player can interact with Journal.
  - Action points for inventory actions to append to playerAction. Buttons turn into Toggles.
  - Picture and Map items with image support.
  - Saving images in the IndexedDB and save file.

v1.5 Backstory update
  - Character Generation.
  - Backstory generation: 5 years, 3 years, 1 year, 6 months, 1 month, 1 week, yesterday.
  - Extraction of extra lore from backstory that should not change.
  - Interactive backstory generation for the custom mode, random generation, based on old choices durin shifts.
  - Character sheet (per Theme)
  - Conversion of Character Sheet from Theme to Theme.
  - Flag about whether an NPC knows player's name.
  - NPCs attitude towards the Player.

v future? On the Road update
  - Mobile Locations, large multi-crew vehicles (Ships, Airships, Spaseships, ...)
  - Separate sub-graphs, dynamically connected to main map.
  - Vehicle Builder AI: constructs all the necessary parts of a vehicle. Vehicle are immutable afterwards.

Money item type that is auto-consumed and is added to a variable set. With unique animation.

Adaptive color theme by world theme.
