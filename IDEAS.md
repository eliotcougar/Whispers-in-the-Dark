IDEAS:

v1.5 Backstory update
  + Character Generation.
  + Backstory generation: 5 years, 3 years, 1 year, 6 months, 1 month, 1 week, yesterday, now.
  + Extraction of extra lore from backstory that should not change.
  + Action points for inventory actions to append to playerAction. Buttons turn into Toggles.

v1.5.1 Bugfix
  + Keep generating the new turn while some modals are on screen.
  + Start turn early and run Loremaster in background.
  + Flag about whether an NPC knows player's name.
  + NPCs attitude towards the Player.

v1.5.2 Bugfix
  + Combine MapNode and MapNodeData to flatten the object.
  + Combine MapEdge and MapEdgeData to flatten the object.
  + Also update the Schemas, Prompts, and examples.
  - Further delineate responsibilities of the System Prompt and Prompt Builder in each service.
  - Simplify GameState Update-from-AI types similar to mapUpdate.
  - Have types for each entity type and verify/fix each of them separately.
  - Reconsider required/optional fields.
  - Unify correction service functions by making them more generic - rebuild an incomplete data structure, given the error text, context, and schema.
  - Possibly, it will be easier to recreate most correction functions from scratch.

v future? On the Road update
  - Calm and Action global states to define when the player can interact with Journal.
  - Mobile Locations, large multi-crew vehicles (Ships, Airships, Spaseships, ...) as eparate sub-graphs, dynamically connected to main map.
  - Vehicle Builder AI: constructs all the necessary parts of a vehicle. Vehicle are immutable afterwards.
  - Storyteller should not generate Items JSONs. Let it generate free-form descriptions/hints for items and books separately.

Money item type that is auto-consumed and is added to a variable set. With unique animation.
