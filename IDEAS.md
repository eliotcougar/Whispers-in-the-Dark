IDEAS:

+ Store a global turn number in the Game State. May get useful.
+ Reasses the 'use' action in itemChange. Feels wrong to have it there.

Using items is a mess, they have their own states.
  - Isolate scene actions and item actions. Up to three item actions per turn, using an auxiliary model to generate outcomes, then the next scene generates automatically.
  - Make the status a free-form string. May be more versatile than Active/Inactive.

Spatio-temporal Continuity update:
  + Map data structure.
  + Selection of relevant map nodes for context.
  + Items can be left at map nodes and retrieved later. (Items in World Inventory with location tags)
    - Automatic conversion of erroneous Item Map Nodes to normal Items.
    + Item retreival from World Inventory.
    + Visual indication of items on the map.
    - Storyteller AI can place items -> NPCs can have items in their inventory. Limited to current Place and Nearby NPCs.
    - Giving/taking items to/from NPCs during dialogue -> NPCs can have items in their inventory.
    - (Debated) Storyteller AI can give/take items to/from known/new NPCs and move them around.
    - Map AI can place new items on the map.
  + Map view. Graph.
    + Drag.
    + Zoom.
    + View nodes details.
    + View links details.
  - Mobile Locations (Ships, Airships, Spaseships, Cars, ...) - inherently linked to Vehicle-type items.
  + Reduce the variety of node and edge types. Cleanup.
  + More node hierarchies (Area, Settlement, Building, Room)
  + Correction services for "Validation Error (NodeData - Update): Invalid 'status'. Value:"  "removed"

Ink and Quill update
 - Notebook item type with real text notes inside.
 - Book item type with real chapters inside.
 - Fact list, storing random static facts.

Money item type that is auto-consumed and is added to a variable set. With unique animation.

Adaptive color theme by world theme.
