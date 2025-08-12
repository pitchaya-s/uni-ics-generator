import json
import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, Response
from icalendar import Calendar, Event, Alarm

app = Flask(__name__)

def parse_weeks(weeks_str):
    """Parse weeks string like '1-13' or '1,3,5,7,9,11,13' into list of integers"""
    if not weeks_str:
        return []
    weeks = []
    for part in weeks_str.split(','):
        if '-' in part:
            start, end = map(int, part.split('-'))
            weeks.extend(range(start, end + 1))
        else:
            weeks.append(int(part))
    return sorted(set(weeks))

def get_teaching_week(calendar_week, recess_weeks):
    """
    Convert a calendar week to a teaching week.
    For example, if week 8 is a recess week, then calendar week 9 is teaching week 8.
    """
    # Count how many recess weeks come before the calendar week
    recess_count = sum(1 for rw in recess_weeks if rw < calendar_week)
    return calendar_week - recess_count

def adjust_calendar_date(week, recess_weeks):
    """
    Adjust the calendar date calculation based on recess weeks.
    This adds extra weeks to account for recess periods.
    """
    # Count how many recess weeks come before the current week
    recess_offset = sum(1 for rw in recess_weeks if rw <= week)
    return week + recess_offset

def time_str_to_datetime(base_date, day_str, time_str):
    """Convert day + time like Mon + 0930to1020 or 0930-1020 into start datetime and end datetime"""
    day_map = {'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6}
    day_offset = day_map[day_str]
    
    # Support both 'to' and '-' as separator
    if 'to' in time_str:
        start_time, end_time = time_str.split('to')
    elif '-' in time_str:
        start_time, end_time = time_str.split('-')
    else:
        raise ValueError("Time string must contain 'to' or '-' as separator")
    
    start_hour = int(start_time[:2])
    start_min = int(start_time[2:])
    end_hour = int(end_time[:2])
    end_min = int(end_time[2:])

    date = base_date + timedelta(days=day_offset)
    start_dt = datetime(date.year, date.month, date.day, start_hour, start_min)
    end_dt = datetime(date.year, date.month, date.day, end_hour, end_min)
    return start_dt, end_dt

def generate_ics(data):
    """Generate an iCalendar file from JSON data"""
    global_settings = data.get('global', {})
    courses = data.get('courses', [])

    # Parse recess weeks from global settings if available
    recess_weeks_str = global_settings.get('recess_weeks', '')
    recess_weeks = parse_weeks(recess_weeks_str)

    # Semester week 1 Monday date
    semester_start_str = global_settings.get('semester_start')
    if not semester_start_str:
        raise ValueError("semester_start not found in config")
    
    semester_start = datetime.strptime(semester_start_str, '%d/%m/%Y')

    cal = Calendar()
    cal.add('version', '2.0')

    for course in courses:
        for session in course.get('sessions', []):
            if not all(key in session for key in ['type', 'day', 'time', 'location', 'weeks']):
                continue  # Skip incomplete sessions
                
            weeks = parse_weeks(session['weeks'])
            # For each week, create an event
            for w in weeks:
                # Calculate actual date of the class, adjusting for recess weeks
                adjusted_week = adjust_calendar_date(w, recess_weeks)
                base_week_date = semester_start + timedelta(weeks=adjusted_week-1)
                start_dt, end_dt = time_str_to_datetime(base_week_date, session['day'], session['time'])

                name_template = global_settings.get('name', '{code} {name} - {type}')
                name = name_template.format(code=course.get('code', ''), 
                                           name=course.get('name', ''), 
                                           type=session.get('type', ''))

                description_template = session.get('description', global_settings.get('description', ''))
                # Use the teaching week number in the description
                teaching_week = get_teaching_week(w, recess_weeks)
                description = description_template.format(week=teaching_week)

                event = Event()
                event.add('summary', name)
                event.add('dtstart', start_dt)
                event.add('dtend', end_dt)
                event.add('location', session['location'])
                event.add('description', description)
                event.add('dtstamp', datetime.now())

                # Add alarm for notification
                notification_minutes = session.get('notification', global_settings.get('notification', 15))
                if notification_minutes:
                    alarm = Alarm()
                    alarm.add('action', 'DISPLAY')
                    alarm.add('description', 'Reminder')
                    alarm.add('trigger', timedelta(minutes=-notification_minutes))
                    event.add_component(alarm)

                cal.add_component(event)

    return cal.to_ical()

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate():
    """Generate iCalendar from submitted data"""
    data = request.json
    try:
        ics_data = generate_ics(data)
        return Response(
            ics_data,
            mimetype='text/calendar',
            headers={'Content-Disposition': 'attachment; filename=timetable.ics'}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/validate', methods=['POST'])
def validate():
    """Validate the submitted data"""
    data = request.json
    errors = []
    
    # Check global settings
    global_settings = data.get('global', {})
    if not global_settings.get('semester_start'):
        errors.append("Semester start date is required")
    
    # Check at least one course
    courses = data.get('courses', [])
    if not courses:
        errors.append("At least one course is required")
    
    # Check each course has required fields
    for i, course in enumerate(courses):
        if not course.get('code'):
            errors.append(f"Course {i+1} must have a code")
        if not course.get('name'):
            errors.append(f"Course {i+1} must have a name")
        
        # Check each session has required fields
        for j, session in enumerate(course.get('sessions', [])):
            if not session.get('type'):
                errors.append(f"Session {j+1} in course {course.get('code', i+1)} must have a type")
            if not session.get('day'):
                errors.append(f"Session {j+1} in course {course.get('code', i+1)} must have a day")
            if not session.get('time'):
                errors.append(f"Session {j+1} in course {course.get('code', i+1)} must have a time")
            if not session.get('location'):
                errors.append(f"Session {j+1} in course {course.get('code', i+1)} must have a location")
            if not session.get('weeks'):
                errors.append(f"Session {j+1} in course {course.get('code', i+1)} must have weeks")
    
    if errors:
        return jsonify({'valid': False, 'errors': errors}), 400
    
    return jsonify({'valid': True})