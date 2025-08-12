# University Timetable to ICS Generator

This web application converts a university course schedule into an iCalendar (`.ics`) file. This allows you to import your timetable into most calendar applications (e.g. Google Calendar, Apple Calendar, Outlook).

## Features

- Interactive web interface for easy schedule creation
- JSON import/export for saving and sharing configurations
- Supports recess weeks and automatically adjusts teaching week numbering
- Creates individual calendar events for each lecture, tutorial, or lab session
- Supports custom reminders for each session
- Allows for global and per-session default settings

## Usage

1.  **Access the application** at [https://uni-ics-generator.vercel.app](https://uni-ics-generator.vercel.app)

2.  **Global Settings:**
    - Set the semester start date (required) - this should be the Monday of teaching week 1
    - Enter recess weeks if applicable (e.g., "8" to indicate a recess in week 8)
    - Customize the event name template, description format, and default notification time

3.  **Adding Courses and Sessions:**
    - Click "Add Course" to add a new course
    - Enter the course code and name
    - Add sessions (lectures, tutorials, labs) for each course
    - Specify the day, time, location, and teaching weeks for each session

4.  **Generate and Download:**
    - Click "Generate ICS" to create your calendar file
    - The timetable.ics file will download automatically
    - Import this file into your calendar application

5.  **Save Your Configuration:**
    - Click "Save Config as JSON" to download your configuration
    - You can reload this configuration later using the JSON tab

## Using JSON (Advanced)

For advanced users who prefer working directly with JSON or automating timetable generation, here's the JSON structure used by the application:

### Top-Level `global`

This is an object that contains global values that apply to all courses and sessions unless overridden at a more specific level.

```json
{
  "global": {
    "semester_start": "11/08/2025",
    "recess_weeks": "8",
    "name": "{code} {name} - {type}",
    "description": "Teaching Week {week}",
    "notification": 15
  },
  "courses": [
    ...
  ]
}
```

-   `semester_start`: The start date of the first week of the semester in `dd/mm/YYYY` format. This is a **required** field.
-   `recess_weeks` (optional): Specifies which weeks are recess weeks (no classes). Uses the same format as session's `weeks` field (e.g., "7" or "7,8" or "7-8"). When a recess week is specified (e.g., week 8), that week is skipped in the calendar, and subsequent weeks are adjusted so that calendar week 9 becomes teaching week 8, week 10 becomes teaching week 9, etc.
-   `name` (optional): A template for the event title.
    -   `{code}`: The course code (e.g., "MA2002").
    -   `{name}`: The course name (e.g., "Advanced Mathematics").
    -   `{type}`: The session type (e.g., "Lecture").
-   `description` (optional): A default description for each session. The `{week}` placeholder will be replaced with the current teaching week number.
-   `notification` (optional): The default number of minutes for a reminder before each session.

### `courses` Array

This is a list of course objects. Each course object has the following structure:

```json
{
  "code": "CS1001",
  "name": "Introduction to Programming",
  "sessions": [
    ...
  ]
}
```

-   `code`: The course code (e.g., "SC1003").
-   `name`: The full name of the course.
-   `sessions`: A list of session objects for this course.

### `sessions` Array

Each session object represents a specific class meeting.

```json
{
  "type": "Lecture",
  "day": "Mon",
  "time": "0930to1020",
  "location": "https://example.com/lecture-link",
  "weeks": "1-13",
  "notification": 30,
  "description": "Custom description for this lecture. Week: {week}"
}
```

-   `type`: The type of session (e.g., "Lecture", "Tutorial", "Lab").
-   `day`: The day of the week ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").
-   `time`: The start and end time in 24-hour format, separated by either "to" (e.g., "0930to1020") or a hyphen "-" (e.g., "0930-1020", "0930to1020").
-   `location`: The location of the session. This can be a physical room number or a URL for online classes.
-   `weeks`: The weeks in which this session occurs. This can be a range (`"2-13"`), a comma-separated list (`"2,4,6,8"`), or a combination.
-   `notification` (optional): A session-specific reminder in minutes. Overrides the global default.
-   `description` (optional): A session-specific description. Overrides the global default. The `{week}` placeholder is supported.