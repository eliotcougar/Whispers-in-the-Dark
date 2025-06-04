IDEAS:

+ Store a global turn number in the Game State. May get useful.
+ Reasses the 'use' action in itemChange. Feels wrong to have it there.

Using items is a mess, they have their own states.
  - Isolate scene actions and item actions. Up to three item actions per turn, using an auxiliary model to generate outcomes, then the next scene generates automatically.
  - Make the status a free-form string. May be more versatile than Active/Inactive.

Spatio-temporal Continuity update:
  + Map data structure.
  + Selection of relevant map nodes for context.
  - Items can be left at map nodes and retrieved later. (Items in World Inventory with location tags, Automatic linkage of Item type leaves to items in world.)
    - Item retreival from World Inventory and Map Item leaves.
    - Visual indication of known or rumored items.
  + Map view. Graph.
    + Drag.
    + Zoom.
    + View nodes details.
    + View links details.
    - Ability to click the main node to hide all its leaves. Still count for context.
  - Mobile Locations (Ships, Airships, Spaseships, Cars, ...) - inherently linked to Vehicle-type items.
  + Reduce the variety of node and edge types. Cleanup.
  - More node hierarchies (Area, Settlement, Building, Room)
  + Correction services for "Validation Error (NodeData - Update): Invalid 'status'. Value:"  "removed"

Ink and Quill update
 - Notebook item type with real text notes inside.
 - Book item type with real chapters inside.
 - Fact list, storing random static facts.

Money item type that is auto-consumed and is added to a variable set. With unique animation.

Adaptive color theme by world theme.
