I do not like the current mobile UI. Redesign the mobile layout to feel closer to the mobile UI of the app Boosted.

Focus only on mobile.

Required layout:

1. Bottom sticky navigation bar

Add a sticky horizontal bar fixed to the bottom of the screen.

It contains:

A. Hamburger button on the left

When clicked, open a bottom sheet menu.

The bottom sheet should:
- slide up from the bottom
- overlay about half of the screen
- contain buttons for:
    - Reports
    - Timers
    - Calendar
    - Settings

For now, Reports, Timers, and Calendar can be empty placeholder buttons.

Settings should open the existing mobile settings screen.

B. Projects button in the center

When clicked, open a bottom sheet that overlays slightly more than half of the screen.

The projects sheet should contain:
- a "+ Add new project" button at the top
- clicking it opens the existing project creation screen
- below it, show all existing projects
- each project row has a "Start" button on the right

When clicking Start:
- if no timer is running, start a timer for that project
- if a timer is already running, stop the current timer and start a new timer for the selected project

2. Main mobile screen

The main screen should be a list of time logs grouped by day.

Example:

Today

- Programming    [> 01:41:20]
  CUDA

- Programming    [> 01:03:20]
  Competitive Programming

- Math           [> 00:30:20]
  Linear Algebra

- Programming    [> 02:20:45]

Explanation:
- Programming and Math are projects
- CUDA, Competitive Programming, and Linear Algebra are tasks
- a log may have no task; in that case only show the project
- the [> duration] element is a button
- clicking the [> duration] button starts a new timer using the same project/task combination as that log
- if another timer is running, stop it first, then start the new one

Keep the UI clean, compact, and touch-friendly.
Do not change the database schema.
Do not rewrite unrelated desktop UI unless necessary.
