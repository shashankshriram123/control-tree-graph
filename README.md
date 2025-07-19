Control Tree Graph Implementation
This is a web-based, interactive control tree graph built with HTML, CSS, and vanilla JavaScript. It allows users to dynamically create, manipulate, and visualize complex hierarchical structures on an infinite canvas.

Features
Dynamic Branching: Create new sub-branches from any node.

Vertical Extension: Expand branches vertically by adding new head nodes.

Automatic Layout: A robust, recursive algorithm automatically reorganizes the graph after every action to maintain a clean, hierarchical, and collision-free layout.

Infinite Canvas: Pan around the canvas to create large and complex graphs.

Node Management:

Select, create, and expand nodes.

Delete individual nodes, extensions, or entire sub-trees (children).

Visibility Controls:

Fold/Unfold Children: Collapse and expand entire sub-trees to manage visual complexity.

Collapse/Unfold Extension: Collapse and expand the vertical extension of any branch.

Visual indicators (a neon glow) show where content is hidden.

Action Log: A real-time log tracks every action performed on the graph for easy debugging and review.

How to Run
This is a pure front-end application with no server-side dependencies.

Clone or download the repository.

Ensure your project structure is as follows:

/your-project-folder/
|-- index.html
|-- css/
|   |-- style.css
|-- js/
|   |-- main.js

Open the index.html file in any modern web browser.
