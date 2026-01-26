# johndelker.github.io

Personal academic website for John Delker, a graduate student in Astrophysics and Computational Math, Science & Engineering (CMSE) at Michigan State University. This repository contains both a personal academic website and an attendance tracking tool used for teaching assistant duties.

## Project Structure

The website consists of two main components:

### 1. Main Academic Website (`index.html`)

A single-page personal website designed for networking and job-finding purposes. It features:

- **Hero Section**: Introduction with portrait placeholder and brief bio
- **Research Section**: Current projects and research interests
- **Software & Tools Section**: Experience with simulation codes and computational skills
- **Teaching & Outreach Section**: Teaching and public outreach activities
- **Navigation**: Smooth scroll navigation to different sections
- **Social Links**: Email, ORCID, GitHub, and LinkedIn integration
- **Responsive Design**: Mobile-friendly layout with CSS Grid
- **Dark Mode Support**: Automatic dark mode based on system preferences using CSS custom properties

**Technical Details:**
- Pure HTML/CSS/JavaScript (no frameworks)
- Inline styles for portability
- Minimal JavaScript (only for dynamic copyright year)
- Semantic HTML with accessibility considerations
- Meta tags for SEO and social sharing

### 2. Attendance Tool (`attendance.html`)

A web-based attendance tracking application for managing student attendance in classes. This tool interfaces with a Google Apps Script backend to load and submit attendance data.

**Features:**
- **Student List Management**: Loads student names and group assignments from a Google Sheets backend
- **Flexible Grouping Options**:
  - Group by Group Number (organizes students by their assigned group)
  - Group by Alphabetical (organizes students alphabetically by first letter)
- **Flexible Sorting Options**:
  - Sort by Last Name (displays as "Last, First")
  - Sort by First Name (displays as "First Last")
- **Group Assignment**: Select a group number (1-10) or "Do Not Change" to assign selected students to groups during submission
- **Multi-Column Layout**: Responsive 1-3 column layout based on screen size
- **Theme Toggle**: Light/dark mode with preference persistence
- **Selection Persistence**: Maintains checkbox selections during re-renders
- **Error Handling**: Graceful error handling for network issues and invalid data

**Technical Details:**
- Fetches data from Google Apps Script Web App endpoint
- Submits attendance data via POST requests
- Uses localStorage for theme and sorting preferences
- Responsive design with CSS Grid
- Debounced resize handling for performance
- Accessible UI with ARIA labels and semantic HTML

## File Descriptions

### `index.html`
The main academic website. Contains all HTML, CSS (inline), and minimal JavaScript for the personal site.

### `attendance.html`
The attendance tool interface. Loads external JavaScript and CSS files for functionality.

### `app.js`
Main JavaScript file for the attendance tool. Handles:
- Data fetching from Google Apps Script endpoint
- Student list rendering with grouping and sorting
- Checkbox selection management
- Attendance submission
- Theme and preference management
- Responsive column layout calculation
- Name parsing (handles "Last, First" and "First Last" formats)

**Key Functions:**
- `loadRows()`: Fetches student data from the backend
- `render()`: Renders the student list with current grouping/sorting options
- `makeGroupsByGroup()`: Groups students by their assigned group number
- `makeGroupsByLetter()`: Groups students alphabetically
- `renderSequentialGroups()`: Distributes groups across columns evenly
- `parseName()`: Robust name parsing for various formats

### `config.js`
Configuration file containing the Google Apps Script Web App URL. This is the single source of truth for the backend endpoint used by the attendance tool.

**Important**: Update the `WEB_APP_URL` variable if the Google Apps Script deployment URL changes.

### `styles.css`
Stylesheet for the attendance tool. Features:
- CSS custom properties for theming
- Light and dark theme support
- Responsive breakpoints (mobile, tablet, desktop)
- MSU brand colors (Spartan Green)
- Segmented control styling
- Card-based layout

## Usage

### Main Website
Simply open `index.html` in a web browser or deploy to GitHub Pages. The site is self-contained and requires no build process.

### Attendance Tool
1. Ensure `config.js` contains the correct Google Apps Script Web App URL
2. Open `attendance.html` in a web browser
3. The tool will automatically load student data from the configured endpoint
4. Use the controls to:
   - Switch between grouping modes (Group Number vs. Alphabetical)
   - Switch between sorting modes (Last Name vs. First Name)
   - Select a group number to assign (optional)
   - Check students who are present
   - Click "Submit" to save attendance

**Backend Requirements:**
The attendance tool expects a Google Apps Script Web App that:
- Accepts GET requests and returns JSON: `{ok: true, rows: [{name: "...", group: "..."}]}`
- Accepts POST requests with form data: `names` (JSON array) and `group` (string)
- Returns JSON: `{ok: true, updated: [...], grouped: [...], groupApplied: "...", missing: [...]}`

## Development Notes

### Theme System
Both components use CSS custom properties for theming:
- Main website: Automatic dark mode via `@media (prefers-color-scheme: dark)`
- Attendance tool: Manual toggle with localStorage persistence

### Browser Compatibility
- Modern browsers with ES6+ support
- CSS Grid support required
- localStorage for preference persistence

### Dependencies
- None (vanilla JavaScript, no frameworks or libraries)

## Future Improvements

The main website is marked as "WORK IN PROGRESS" and may be expanded with:
- Additional sections (publications, CV, etc.)
- Dynamic content loading
- Enhanced styling and animations
- Blog or news section

## License

Personal project - all rights reserved.
