document.addEventListener('DOMContentLoaded', function() {
    // Initialize the form with one empty course
    addCourse();

    // Event listeners for add/remove buttons
    document.getElementById('addCourseBtn').addEventListener('click', addCourse);
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfigFromForm);
    document.getElementById('saveJsonBtn').addEventListener('click', saveJsonToFile);
    document.getElementById('loadJsonToFormBtn').addEventListener('click', loadJsonToForm);
    document.getElementById('generateFromJsonBtn').addEventListener('click', generateFromJson);
    document.getElementById('timetableForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('loadJsonFile').addEventListener('change', loadJsonFromFile);
    
    // Add event delegation for dynamically added elements
    document.addEventListener('click', function(e) {
        // Remove course button
        if (e.target.classList.contains('remove-course')) {
            const courseCard = e.target.closest('.course-card');
            courseCard.remove();
            updateCourseNumbers();
        }
        
        // Add session button
        if (e.target.classList.contains('add-session-btn')) {
            const coursesContainer = e.target.closest('.course-card');
            const sessionsContainer = coursesContainer.querySelector('.sessions-container');
            addSession(sessionsContainer);
        }
        
        // Remove session button
        if (e.target.classList.contains('remove-session')) {
            const sessionCard = e.target.closest('.session-card');
            const sessionsContainer = sessionCard.parentElement;
            sessionCard.remove();
            updateSessionNumbers(sessionsContainer);
        }
    });
});

function addCourse() {
    const coursesContainer = document.getElementById('coursesContainer');
    const courseTemplate = document.getElementById('courseTemplate');
    const courseClone = document.importNode(courseTemplate.content, true);
    
    // Add course number
    const courseNumber = coursesContainer.children.length + 1;
    courseClone.querySelector('.course-number').textContent = courseNumber;
    
    // Add one empty session
    const sessionsContainer = courseClone.querySelector('.sessions-container');
    addSession(sessionsContainer);
    
    coursesContainer.appendChild(courseClone);
}

function addSession(sessionsContainer) {
    const sessionTemplate = document.getElementById('sessionTemplate');
    const sessionClone = document.importNode(sessionTemplate.content, true);
    
    // Add session number
    const sessionNumber = sessionsContainer.children.length + 1;
    sessionClone.querySelector('.session-number').textContent = sessionNumber;
    
    sessionsContainer.appendChild(sessionClone);
}

function updateCourseNumbers() {
    const courseCards = document.querySelectorAll('.course-card');
    courseCards.forEach((card, index) => {
        card.querySelector('.course-number').textContent = index + 1;
    });
}

function updateSessionNumbers(sessionsContainer) {
    const sessionCards = sessionsContainer.querySelectorAll('.session-card');
    sessionCards.forEach((card, index) => {
        card.querySelector('.session-number').textContent = index + 1;
    });
}

function formatDateForJson(dateString) {
    // Convert from YYYY-MM-DD to DD/MM/YYYY
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

function parseDateForInput(dateString) {
    // Convert from DD/MM/YYYY to YYYY-MM-DD
    if (!dateString) return '';
    const parts = dateString.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function collectFormData() {
    const data = {
        global: {
            semester_start: formatDateForJson(document.getElementById('semesterStart').value),
            recess_weeks: document.getElementById('recessWeeks').value.trim(),
            name: document.getElementById('eventNameTemplate').value.trim(),
            description: document.getElementById('eventDescription').value.trim(),
            notification: parseInt(document.getElementById('notification').value) || 15
        },
        courses: []
    };
    
    // Collect course data
    const courseCards = document.querySelectorAll('.course-card');
    courseCards.forEach(card => {
        const course = {
            code: card.querySelector('.course-code').value.trim(),
            name: card.querySelector('.course-name').value.trim(),
            sessions: []
        };
        
        // Collect session data for this course
        const sessionCards = card.querySelectorAll('.session-card');
        sessionCards.forEach(sessionCard => {
            const session = {
                type: sessionCard.querySelector('.session-type').value,
                day: sessionCard.querySelector('.session-day').value,
                time: sessionCard.querySelector('.session-time').value.trim(),
                location: sessionCard.querySelector('.session-location').value.trim(),
                weeks: sessionCard.querySelector('.session-weeks').value.trim()
            };
            
            // Add notification only if provided
            const notification = sessionCard.querySelector('.session-notification').value.trim();
            if (notification) {
                session.notification = parseInt(notification);
            }
            
            course.sessions.push(session);
        });
        
        data.courses.push(course);
    });
    
    return data;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const data = collectFormData();
    
    try {
        // Validate data on server
        const validateResponse = await fetch('/api/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const validateResult = await validateResponse.json();
        if (!validateResult.valid) {
            alert('Validation failed: ' + validateResult.errors.join('\n'));
            return;
        }
        
        // Generate ICS file
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate ICS');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'timetable.ics';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function saveConfigFromForm() {
    const data = collectFormData();
    const jsonString = JSON.stringify(data, null, 2);
    saveJsonString(jsonString);
}

function saveJsonToFile() {
    const jsonString = document.getElementById('jsonInput').value;
    try {
        // Check if it's valid JSON
        JSON.parse(jsonString);
        saveJsonString(jsonString);
    } catch (e) {
        alert('Invalid JSON format: ' + e.message);
    }
}

function saveJsonString(jsonString) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable_config.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function loadJsonToForm() {
    try {
        const jsonString = document.getElementById('jsonInput').value;
        const data = JSON.parse(jsonString);
        
        // Clear existing courses
        document.getElementById('coursesContainer').innerHTML = '';
        
        // Set global values
        if (data.global) {
            document.getElementById('semesterStart').value = parseDateForInput(data.global.semester_start);
            document.getElementById('recessWeeks').value = data.global.recess_weeks || '';
            document.getElementById('eventNameTemplate').value = data.global.name || '';
            document.getElementById('eventDescription').value = data.global.description || '';
            document.getElementById('notification').value = data.global.notification || '';
        }
        
        // Add courses and sessions
        if (data.courses && data.courses.length > 0) {
            data.courses.forEach(courseData => {
                addCourse();
                const courseCards = document.querySelectorAll('.course-card');
                const currentCourse = courseCards[courseCards.length - 1];
                
                currentCourse.querySelector('.course-code').value = courseData.code || '';
                currentCourse.querySelector('.course-name').value = courseData.name || '';
                
                // Remove default session
                const sessionsContainer = currentCourse.querySelector('.sessions-container');
                sessionsContainer.innerHTML = '';
                
                // Add sessions
                if (courseData.sessions && courseData.sessions.length > 0) {
                    courseData.sessions.forEach(sessionData => {
                        addSession(sessionsContainer);
                        const sessionCards = sessionsContainer.querySelectorAll('.session-card');
                        const currentSession = sessionCards[sessionCards.length - 1];
                        
                        currentSession.querySelector('.session-type').value = sessionData.type || '';
                        currentSession.querySelector('.session-day').value = sessionData.day || '';
                        currentSession.querySelector('.session-time').value = sessionData.time || '';
                        currentSession.querySelector('.session-location').value = sessionData.location || '';
                        currentSession.querySelector('.session-weeks').value = sessionData.weeks || '';
                        currentSession.querySelector('.session-notification').value = sessionData.notification || '';
                    });
                }
            });
        }
        
        // Switch to form tab
        const formTab = document.getElementById('form-tab');
        const bsTab = new bootstrap.Tab(formTab);
        bsTab.show();
        
    } catch (e) {
        alert('Error loading JSON: ' + e.message);
    }
}

async function generateFromJson() {
    try {
        const jsonString = document.getElementById('jsonInput').value;
        const data = JSON.parse(jsonString);
        
        // Validate data on server
        const validateResponse = await fetch('/api/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const validateResult = await validateResponse.json();
        if (!validateResult.valid) {
            alert('Validation failed: ' + validateResult.errors.join('\n'));
            return;
        }
        
        // Generate ICS file
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate ICS');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'timetable.ics';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function loadJsonFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('jsonInput').value = e.target.result;
    };
    reader.onerror = function() {
        alert('Error reading file');
    };
    reader.readAsText(file);
}
