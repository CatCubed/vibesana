# Vibesana

A fast, board-only Asana client that runs in your browser.

Asana's own board renders every column and every card up front. This one loads a column only when it scrolls into view, skips completed tasks, fetches 50 cards per page, and virtualizes long columns so only about 20 cards are in the DOM at a time. Boards are cached in IndexedDB, so reopening one is instant, and changes from other people come in through Asana's Events API every 15 s while the tab is visible.

## Tests

`npm test` runs the unit tests (Vitest + jsdom) for the link parsing, the rich-text conversion and the drag-and-drop ordering helpers.

## Run

```sh
npm install
npm start          # build + serve on http://localhost:5199
npm run dev        # hot-reload dev server, same port
```

Asana API calls go through the Vite server (`/asana/*` → `https://app.asana.com/api/1.0/*`), so either command must be running while you use the app. Opening `dist/index.html` directly won't work.

To get a separate window: in Chrome, open the page and use **⋮ → Cast, save and share → Install page as app**.

## First run

1. Create a personal access token at <https://app.asana.com/0/my-apps>.
2. Paste it into the app. It is stored only in this browser's localStorage.
3. Pick a project in the sidebar: your Asana favorites are under Starred, or search for any project.

## Look & feel

Asana's board with a calmer look: dark gray "Tock" theme / soft light theme, Nunito, panel columns with soft shadows, pill filters, a glow on the active accent. Personalization lives in the account menu (bottom of the sidebar): theme mode (system/light/dark) with a choice of dark theme (Tock, Graphite, Black, Catppuccin Mocha / Macchiato / Frappé, Darcula, Dracula, Nord, Tokyo Night, Gruvbox Dark, One Dark, Solarized Dark, Rosé Pine, GitHub Dark, Everforest Dark, Monokai, Night Owl, Ayu Dark, Ayu Mirage, Kanagawa) and light theme (Tock Light, Light, Paper, Catppuccin Latte, GitHub Light, One Light, Solarized Light, Gruvbox Light, Nord Light, Rosé Pine Dawn, Everforest Light, Ayu Light), accent color (the theme's own colour, 14 presets or any custom colour), font (sans: Nunito, Nunito Sans, Manrope, Plus Jakarta Sans, Inter, DM Sans, Figtree, Rubik, IBM Plex Sans, Source Sans 3, Work Sans, Lexend, Outfit, Space Grotesk, Roboto, Open Sans; monospace: JetBrains Mono, Fira Code, IBM Plex Mono, Source Code Pro, Roboto Mono; or System — the extra ones are fetched from Google Fonts when picked; all fonts are scaled to the same lowercase height so none looks bigger than another), text size (S/M/L/XL), animations on/off, density (comfortable/compact), column width (S/M/L/XL), glow on/off, project indicator on cards (chip / stripe / both / off), show completed. All stored in the browser.

Cards show a colored **project chip** (and/or a left stripe) for every project a task is in other than the one you're viewing, using the project's Asana color by default. Hover a project in the sidebar and click the palette icon, click the color dot next to a project in the task panel, or right-click a project chip on a card, to give it your own color (Asana palette or any custom color); the override also recolors the project's icon and is stored only in your browser, so each person can have their own.

## Features

- **Task shortcuts like Asana's**: hold Tab (or press it first) and then M assign to me, A assignee, D due date, C comment, L like, F collaborator, P project, S subtask, N section, X wide/narrow, Q new task, Backspace delete (with Undo); Ctrl+Enter completes the open task. They only act while focus is on the task, never behind a popup
- **Own dialogs and dropdowns**: every confirmation, prompt and dropdown is Vibesana's own, themed like the rest (no browser dialogs or native selects); Esc closes only the innermost popup; pickers flip to the side that fits
- **Own tooltips**: hover hints are themed too, and also appear for the control you reach with the keyboard
- **Link dialog**: Ctrl+K or the toolbar button; a bare address gets https://, an e-mail becomes mailto:, and on an existing link you can change or clear the address
- **Reorder columns by dragging** their header; the `⋯` menu still has Move left / right
- **Calendar ranges**: a task with a start date spans its days
- **Filters are remembered** per project (assignee, due, field), without saving a view
- **Drag while filtered or sorted**: a drop lands before the card it was dropped on
- **Open task stays current**: comments and changes made elsewhere appear within 30 seconds while nothing is being edited; an unsent comment survives switching tasks
- **My Tasks keeps up**: refreshes every minute and when you return to the tab; Undo for completing and rescheduling; quick edit of assignee and due date; Ctrl/Shift+click multi-select with bulk complete and drag
- **Offline and expired tokens**: one notice when Asana cannot be reached and one when it is back (polling backs off meanwhile); a revoked token brings up the token screen; signing out clears cached data
- **Tables in descriptions** are shown and saved as tables
- **My Tasks** (sidebar): everything assigned to you, in Overdue / Today / Tomorrow / This week / Later / No date columns; drop a task into a column to reschedule it, `+` adds a task due in that bucket
- **Activity** (sidebar button, opens a popup beside the sidebar so the board stays visible): an approximation of Asana's Inbox, which the API does not expose. Shows the last 14 days of comments and changes by other people (not your own, not Asana's automatic ones such as ID fields) on tasks you are assigned to or following, grouped by task, with All / New / Comments / Mentions tabs, a "new" badge in the sidebar and "Mark all read". "New" is tracked per browser; it refreshes every 2 minutes and needs Asana's search API (paid plans)
- **Pinned and recent tasks** (sidebar): Pinned and Recent tasks sit under a divider below the project list, so projects and tasks never mix; the last eight tasks you opened appear there under Recent; hover one and click 📌 to pin it, or pin from the task panel (📌 in the header or the ⋯ menu). Pinned tasks stay until unpinned; both lists live in your browser
- **Subtask progress on cards**: tasks with subtasks show done/total instead of a plain count (bolder when all are done); counted in the background for visible cards and updated at once when you tick subtasks in the task panel
- **Keyboard shortcuts overview**: press `?`, or use "Keyboard shortcuts" in the account menu or the command bar
- **Mark single Activity items as read**: click an update's dot, or "✓ Read" on a task group; "Mark all read" still clears everything
- **Compact sidebar opens on hover**: with the sidebar collapsed to icons, hovering it shows the full sidebar over the page (projects, pinned and recent tasks, search) until the pointer leaves; » keeps it open
- **Docked task panel**: a task opens beside the board, which stays visible and usable, and the open task's card is highlighted; "Dock task panel" in the account menu switches back to the overlay
- **Add task at the bottom**: each column has "+ Add task" under its last card (Enter keeps adding); the header `+` still adds at the top
- **Subtask details inline**: hover a subtask row to set its due date or assignee without opening it
- **Keyboard on the board**: arrows move a focus ring between cards and columns, Enter opens, `c` completes, `n` adds a task to the focused column, `x` or Space selects, Esc clears
- **Quick edits on cards**: hover a card for assignee and due-date buttons, or click the avatar, the due date or a custom-field chip to change it without opening the task
- **New task dialog** (`Shift+N` when not typing, or `Alt+N`; "+ New task" in the sidebar, or `!New task` in the command bar): name, project and column, assignee, due date, description
- **Task menu (⋯ in the task panel)**: duplicate, convert a subtask to a task or a task to a subtask, delete (with Undo)
- **Shareable links**: the address bar always points at the current project, view and open task (`#/project/<id>/task/<id>`, `#/my`, `#/activity`), so it can be bookmarked or sent to someone who runs Vibesana; the link button in the task panel copies the Asana link (what colleagues can open), and the ⋯ menu has "Copy Vibesana link"
- **Toasts and undo**: errors appear as toasts at the top; moving cards, completing tasks and deleting subtasks offer Undo for a few seconds (subtask deletion is only sent to Asana when the toast expires)
- **Desktop notifications** (account menu): a browser notification for new Activity items while Vibesana is in the background; needs the tab to stay open
- **Command bar** (`Ctrl K`): plain text searches tasks across the workspace, `@` searches projects (favorites when empty), `!` lists actions (My Tasks, theme, sidebar, completed, density, glow, refresh, sign out)
- **Board filters & sort**: Assignee (any user), Due (overdue / today / this week / none), Field (custom-field values), Sort (Asana order, due date, name, or a field's option order); they apply to loaded cards and pause drag & drop
- **Project overview**: an Overview mode next to Board / List / Calendar shows the project's key resources (its links and files, clickable), its description and its brief. Read-only, and loaded fresh from Asana each time it is opened — it is never cached or stored in the browser, because this is where credentials tend to live
- **Views per project**: Board, List (table with assignee, due date and custom-field columns; click a header to sort, click a cell to edit) and Calendar (month grid by due date; drag a task to another day). List, Calendar and grouping load every task of the project first
- **Group by field**: the Group pill turns the board's columns into the options of a single-select custom field; dragging a card to another column changes that field
- **Saved views**: the Views pill stores the current filters, sort, grouping and layout under a name, per project
- **Split view**: hover a project in the sidebar and click the split icon (or Ctrl+click / middle-click the project) to show it beside the current board; drag the divider to resize, and close either pane with the ✕ next to its name. In split view, picking a project in the sidebar replaces the pane that has the focus. Dragging a card to the other board adds the task to that project in the column where you drop it and keeps it in the original; hold Shift while dropping to move it instead. A task already in both projects just changes column. In split view each pane is a plain board (no List / Calendar switch, grouping or saved views), the pane with focus has an accent glow, and clicking a tab focuses its pane or opens the project in the focused pane. Tasks open as an overlay while split is on
- **My Tasks calendar**: Board / Calendar switch in My Tasks
- **Multi-select on the board**: Ctrl+click toggles a card, Shift+click selects a range in a column; drag any selected card to move them all (order kept), or use the bar at the bottom: Move to column, Complete, Clear (Esc)
- **Comment counts on cards**: Asana has no such field, so Vibesana counts comments per task in the background for the cards on screen (three requests at a time, cached until the task changes); switch it off under Cards → Comment count
- **Cards menu**: choose which custom fields and built-ins (assignee, due, subtask count, parent, tags) show on cards, per project
- **Current week column**: a column named for the current ISO week (like `2026-w46`) gets a softly glowing "This week" tag next to its title
- **Columns**: `⋯` menu with rename (or double-click the title), add column to left/right (the name box appears in place; next to a week column like `2026-w46` it is pre-filled with the next free week), collapse this/all/empty columns, expand all, move left/right, delete (empty only); "+ Add column" at the end of the board
- **Dates**: calendar picker with quick picks (Today, Tomorrow, Next Monday, In a week, No date) and start–due range highlight
- **Multi-option fields in one go**: in the task panel, a field that allows several values (tags, services …) opens a tick list that stays open; tick as many as you need and it saves once when you click outside or press Esc
- **Arrows while typing**: `->` followed by a space becomes →, and `<-` becomes ←, in descriptions and comments (not inside code)
- **Divider line**: type `---` at the start of a line in a task description to insert a separator, as in Asana; text already on that line moves under it (descriptions only, not comments)
- **Markdown shortcuts while typing** (description, comment box, comment editing): `- ` or `* ` starts a bullet list, `1. ` a numbered list, `# ` / `## ` a heading, and `\`code\``, `**bold**`, `_italic_`, `~~strike~~` convert when the closing mark is typed
- **Block styles on several lines**: select several lines and apply quote, code block or a heading to all of them at once (one quote or code block; one heading per line)
- **Block styles in the editors**: toolbar buttons and hotkeys for large heading (Ctrl+Alt+1), medium heading (Ctrl+Alt+2), code block (Ctrl+Shift+C or typing ``` and Space), quote block (❝ button or typing `>` and Space) and back to normal text (Ctrl+Alt+0); pressing the same style again turns it off; Enter on an empty last line leaves a code or quote block; undo and redo buttons
- **Formatting hotkeys in the editors**: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Shift+X strikethrough, Ctrl+E (or Ctrl+Shift+M) code, Ctrl+Shift+8 bullets, Ctrl+Shift+7 numbered list, Ctrl+K link
- **Images in text**: paste a screenshot or drop an image file into the description editor, the comment box or a comment being edited; it is uploaded to the task and inserted inline. Click an image in an editor and press Backspace or Delete to remove it (Backspace right after an image works too)
- **Description editing ends when you click away**: changes are saved, an untouched description just closes; Esc or Cancel discards
- **Loading placeholders**: shimmering skeletons while a task, a column, subtasks or Activity load, instead of "Loading…" text; menus, pickers and suggestion lists fade in
- **Compact task details**: assignee, dates, collaborators, dependencies and custom fields sit in two columns (one column when the panel is narrow); the Tags row only shows when a task has tags
- **Status history** (task panel): a collapsible timeline of custom-field status changes, column moves and completion, with how long the task stayed in each value and how long it has been in the current one
- **Images**: click an image in a description, comment or the attachments list to view it full screen; click again for actual size (scrollable), Esc closes
- **Comments**: like / unlike with counts; edit and delete your own (hover a comment); pasted URLs become links in comments and descriptions, and links copied from a web page keep their titles; the comment box and comment editing are rich editors (bold, italic, underline, strike, code, lists, links, @mentions)
- Browser history: opening a task, switching to another one, closing it and changing project or view are each a step, so mouse back/forward (and Alt+←/→) walk through them one at a time — back to the previous task, or to no task if none was open
- Links to Asana tasks in descriptions, comments and task mentions open the task in Vibesana (Ctrl/middle-click still opens Asana)

- Lazy columns, paging, virtualized cards
- Asana-style cards: colored custom-field chips, other projects, tags, parent task, start–due range, avatar photos, waiting-on (⌛), click-to-complete
- "Completed" toggle (on by default) and collapsible columns (remembered per project)
- Drag and drop between and within columns (optimistic, rolled back on error)
- Quick-add a task at the top of a column (`+`)
- Task panel modelled on Asana's:
  - header: complete, collaborators (add/remove), like, copy link, open in Asana, expand to wide view
  - assignee picker (any user), start + due date, "Blocked by" and "Blocking" dependencies (add/remove in both directions, click to open)
  - projects with section dropdown and their custom fields, editable (enum, multi-enum, text, number, date); add the task to another project or remove it from one
  - rich-text description with inline images; editor with bold/italic/underline/strike/code/lists/links
  - subtasks with Asana's keyboard flow: Enter (anywhere in the panel) adds a subtask, Tab+N adds a section, Tab+S a subtask, Tab+M assigns to you (the open task, or the subtask whose name you are editing), Enter in a row saves it and adds the next one, Backspace on an empty row deletes it and moves up, ↑/↓ move between rows; rows appear instantly and sync in the background; Ctrl/Shift+click a row (or click its ⋮⋮ handle) to select (Shift range, Ctrl toggle) and Delete removes the selection; drag the ⋮⋮ handle to reorder; click a name to rename, click anywhere else on the row (or ›) to open it (← back)
  - attachments: thumbnails, upload (button or drag & drop), delete
  - activity: Comments / All activity, collapsed system updates, oldest/newest; composer with @mentions
- Filter loaded cards by text or tag (`/`), "Mine" toggle
- Live sync through the Events API; `Esc` closes the drawer
- Sidebar like Asana's: project search, Starred (Asana favorites) and Work (projects you are a member of) with project icons and colors; drag to reorder Work (saved locally, Asana's own order is not in the API); account menu with workspace, show completed, theme, sign out; hide with «

Not supported: timeline, rules, inbox.
