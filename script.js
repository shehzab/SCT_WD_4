let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentFilter = 'all';
let editingTaskId = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
    renderTasks();
    updateStats();
    setDefaultDateTime();
    addExportImportButtons();
    addDragAndDrop();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleShortcuts);

    // Auto-save every 30s
    setInterval(() => { if (tasks.length) saveTasks(); }, 30000);

    // Check reminders every minute
    setInterval(checkTaskReminders, 60000);

    // Event delegation for task actions
    document.getElementById('taskList').addEventListener('click', handleTaskActions);
}

function setDefaultDateTime() {
    const now = new Date();
    document.getElementById('taskDate').value = now.toISOString().split('T')[0];
    document.getElementById('taskTime').value = now.toTimeString().slice(0, 5);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function addTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const category = document.getElementById('taskCategory').value;
    const priority = document.getElementById('taskPriority').value;
    const date = document.getElementById('taskDate').value;
    const time = document.getElementById('taskTime').value;

    if (!title) return alert('Please enter a task title!');

    const task = {
        id: generateId(),
        title, description, category, priority, date, time,
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks.unshift(task);
    saveTasks();
    clearForm();
    renderTasks();
    updateStats();
}

function clearForm() {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskCategory').value = 'work';
    document.getElementById('taskPriority').value = 'low';
    setDefaultDateTime();
}

function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    updateStats();
}

function toggleTask(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks();
    renderTasks();
    updateStats();
}

function editTask(id) {
    editingTaskId = id;
    const taskElement = document.querySelector(`[data-id="${id}"] .edit-form`);
    const task = tasks.find(t => t.id === id);

    taskElement.querySelector('.edit-title').value = task.title;
    taskElement.querySelector('.edit-description').value = task.description || '';
    taskElement.querySelector('.edit-category').value = task.category;
    taskElement.querySelector('.edit-priority').value = task.priority;
    taskElement.querySelector('.edit-date').value = task.date || '';
    taskElement.querySelector('.edit-time').value = task.time || '';

    taskElement.classList.add('active');
}

function saveEdit(id) {
    const editForm = document.querySelector(`[data-id="${id}"] .edit-form`);
    const title = editForm.querySelector('.edit-title').value.trim();
    if (!title) return alert('Task title cannot be empty!');

    tasks = tasks.map(t => t.id === id ? {
        ...t,
        title,
        description: editForm.querySelector('.edit-description').value.trim(),
        category: editForm.querySelector('.edit-category').value,
        priority: editForm.querySelector('.edit-priority').value,
        date: editForm.querySelector('.edit-date').value,
        time: editForm.querySelector('.edit-time').value
    } : t);

    editForm.classList.remove('active');
    editingTaskId = null;
    saveTasks();
    renderTasks();
    updateStats();
}

function cancelEdit(id) {
    document.querySelector(`[data-id="${id}"] .edit-form`).classList.remove('active');
    editingTaskId = null;
}

function filterTasks(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderTasks();
}

function searchTasks() {
    renderTasks();
}

function getFilteredTasks() {
    let filtered = [...tasks];
    const searchTerm = document.getElementById('searchBar').value.toLowerCase();

    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(searchTerm) ||
            t.description.toLowerCase().includes(searchTerm) ||
            t.category.toLowerCase().includes(searchTerm)
        );
    }

    switch (currentFilter) {
        case 'pending': return filtered.filter(t => !t.completed);
        case 'completed': return filtered.filter(t => t.completed);
        case 'overdue': return filtered.filter(isOverdue);
        case 'high': return filtered.filter(t => t.priority === 'high');
        case 'today':
            const today = new Date().toISOString().split('T')[0];
            return filtered.filter(t => t.date === today);
        default: return filtered;
    }
}

function isOverdue(task) {
    if (!task.date || task.completed) return false;
    return new Date(task.date + ' ' + (task.time || '23:59')) < new Date();
}

function formatDateTime(date, time) {
    if (!date) return '';
    const taskDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    let dateStr = taskDate.toDateString() === today.toDateString()
        ? 'Today'
        : taskDate.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : taskDate.toLocaleDateString();

    if (time) {
        const timeStr = new Date(`2000-01-01 ${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} at ${timeStr}`;
    }
    return dateStr;
}

function generateTaskHTML(task) {
    return `
        <div class="task-item ${task.completed ? 'completed' : ''} ${task.priority}-priority" data-id="${task.id}" draggable="true">
            <div class="task-header">
                <div class="task-title ${task.completed ? 'completed' : ''}">${task.title}</div>
                <div class="task-priority ${task.priority}">${task.priority}</div>
            </div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            <div class="task-meta">
                <div class="task-datetime">
                    ${task.date || task.time ? `⏰ ${formatDateTime(task.date, task.time)}` : ''}
                    ${isOverdue(task) ? ' <span style="color:#f44336;font-weight:bold;">(Overdue)</span>' : ''}
                </div>
                <div class="task-category">${task.category}</div>
            </div>
            <div class="task-actions">
                <button class="btn ${task.completed ? 'btn-warning' : ''}" data-action="toggle" data-id="${task.id}">
                    ${task.completed ? '↶ Undo' : '✓ Complete'}
                </button>
                <button class="btn btn-warning" data-action="edit" data-id="${task.id}">✏️ Edit</button>
                <button class="btn" data-action="duplicate" data-id="${task.id}" style="background:linear-gradient(135deg,#9C27B0 0%,#8E24AA 100%);">📋 Duplicate</button>
                <button class="btn btn-danger" data-action="delete" data-id="${task.id}">🗑️ Delete</button>
            </div>
            <div class="edit-form">
                <div class="form-group"><label>Title</label><input type="text" class="edit-title" value="${task.title}"></div>
                <div class="form-group"><label>Description</label><textarea class="edit-description">${task.description || ''}</textarea></div>
                <div class="form-group"><label>Category</label>
                    <select class="edit-category">
                        ${['work','personal','health','education','shopping','other']
                            .map(c => `<option value="${c}" ${task.category===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Priority</label>
                    <select class="edit-priority">
                        ${['low','medium','high']
                            .map(p => `<option value="${p}" ${task.priority===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Due Date</label><input type="date" class="edit-date" value="${task.date || ''}"></div>
                <div class="form-group"><label>Due Time</label><input type="time" class="edit-time" value="${task.time || ''}"></div>
                <div style="display:flex;gap:10px;margin-top:15px;">
                    <button class="btn" data-action="save" data-id="${task.id}">💾 Save</button>
                    <button class="btn btn-danger" data-action="cancel" data-id="${task.id}">❌ Cancel</button>
                </div>
            </div>
        </div>
    `;
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    const filteredTasks = getFilteredTasks();
    if (!filteredTasks.length) {
        taskList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3M19 19H5V5H19V19M17 17H7V15H17V17M17 13H7V11H17V13M17 9H7V7H17V9Z"/></svg>
                <h3>No tasks found</h3><p>Try adjusting your filters or search terms</p>
            </div>`;
        return;
    }
    taskList.innerHTML = filteredTasks.map(generateTaskHTML).join('');
}

function updateStats() {
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.completed).length;
    document.getElementById('pendingTasks').textContent = tasks.filter(t => !t.completed).length;
    document.getElementById('overdueTasks').textContent = tasks.filter(isOverdue).length;
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function handleShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement.id === 'taskTitle') {
        addTask();
    }
    if (e.key === 'Escape' && editingTaskId) cancelEdit(editingTaskId);
}

function checkTaskReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    tasks.filter(t => !t.completed && t.date && t.time).forEach(task => {
        const taskDateTime = new Date(task.date + ' ' + task.time);
        const diff = taskDateTime - now;
        if (diff > 0 && diff <= 15 * 60 * 1000) {
            new Notification(`Task Reminder: ${task.title}`, {
                body: `Due at ${formatDateTime(task.date, task.time)}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%234CAF50" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
            });
        }
    });
}

function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `tasks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function importTasks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const imported = JSON.parse(e.target.result);
                if (confirm(`Import ${imported.length} tasks?`)) {
                    imported.forEach(t => t.id = generateId());
                    tasks = [...tasks, ...imported];
                    saveTasks();
                    renderTasks();
                    updateStats();
                    alert(`Successfully imported ${imported.length} tasks!`);
                }
            } catch { alert('Error importing tasks.'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

function addExportImportButtons() {
    const sidebar = document.querySelector('.sidebar');
    const div = document.createElement('div');
    div.style.marginTop = '20px';
    div.innerHTML = `
        <h4 style="margin-bottom: 10px; color: #ccc;">Data Management</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-warning" onclick="exportTasks()" style="flex: 1; min-width: 120px;">📥 Export Tasks</button>
            <button class="btn btn-warning" onclick="importTasks()" style="flex: 1; min-width: 120px;">📤 Import Tasks</button>
        </div>
        <div style="margin-top: 10px;">
            <button class="btn btn-danger" onclick="clearAllTasks()" style="width: 100%;">🗑️ Clear All Tasks</button>
        </div>`;
    sidebar.appendChild(div);
}

function clearAllTasks() {
    if (confirm('Are you sure you want to delete ALL tasks? This action cannot be undone!')) {
        if (confirm('This will permanently delete all your tasks. Are you absolutely sure?')) {
            tasks = [];
            saveTasks();
            renderTasks();
            updateStats();
        }
    }
}

function addDragAndDrop() {
    let dragged = null;
    document.addEventListener('dragstart', e => {
        if (e.target.classList.contains('task-item')) {
            dragged = e.target;
            e.target.style.opacity = '0.5';
        }
    });
    document.addEventListener('dragend', e => {
        if (e.target.classList.contains('task-item')) e.target.style.opacity = '';
        dragged = null;
    });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        if (dragged && e.target.classList.contains('task-item')) {
            const draggedId = dragged.dataset.id;
            const targetId = e.target.dataset.id;
            if (draggedId !== targetId) {
                const dIndex = tasks.findIndex(t => t.id === draggedId);
                const tIndex = tasks.findIndex(t => t.id === targetId);
                const [draggedTask] = tasks.splice(dIndex, 1);
                tasks.splice(tIndex, 0, draggedTask);
                saveTasks();
                renderTasks();
            }
        }
    });
}

function duplicateTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        const copy = { ...task, id: generateId(), title: task.title + ' (Copy)', completed: false, createdAt: new Date().toISOString() };
        tasks.unshift(copy);
        saveTasks();
        renderTasks();
        updateStats();
    }
}

function handleTaskActions(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'toggle') toggleTask(id);
    if (action === 'edit') editTask(id);
    if (action === 'delete') deleteTask(id);
    if (action === 'duplicate') duplicateTask(id);
    if (action === 'save') saveEdit(id);
    if (action === 'cancel') cancelEdit(id);
}
