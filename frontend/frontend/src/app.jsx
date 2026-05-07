import { useEffect, useMemo, useRef, useState } from "react";
import "./app.css";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getStartOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateToIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateKey(date) {
  return localDateToIso(date);
}

function formatDateLabel(date) {
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()}`;
}

function formatMonthYear(startDate, endDate) {
  const startMonth = MONTH_NAMES[startDate.getMonth()];
  const endMonth = MONTH_NAMES[endDate.getMonth()];
  const year = startDate.getFullYear();
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startMonth} ${year}`;
  }
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startMonth} - ${endMonth} ${year}`;
  }
  return `${startMonth} ${startDate.getFullYear()} - ${endMonth} ${endDate.getFullYear()}`;
}

const TASK_PRIORITIES = [
  "Critical",
  "High Priority",
  "Medium Priority",
  "Low Priority",
];

const TASK_STATUS_COLUMNS = [
  {
    value: "To-Do List",
    legacyValues: ["Active"],
    emptyText: "New tasks land here when they are ready to plan.",
  },
  {
    value: "In Progress",
    legacyValues: [],
    emptyText: "Drag a task here when work has started.",
  },
  {
    value: "Completed / Closed",
    legacyValues: ["Closed"],
    emptyText: "Completed tasks will collect here for review.",
  },
];

const TASK_STATUS_OPTIONS = TASK_STATUS_COLUMNS.map((column) => column.value);
const TODO_TASK_STATUS = "To-Do List";
const COMPLETED_TASK_STATUS = "Completed / Closed";

const normalizeTaskStatus = (task) => {
  if (task?.completed) return COMPLETED_TASK_STATUS;

  const match = TASK_STATUS_COLUMNS.find(
    (column) =>
      column.value === task?.status ||
      column.legacyValues.includes(task?.status)
  );

  return match?.value || TODO_TASK_STATUS;
};

const isCompletedTaskStatus = (status) =>
  status === COMPLETED_TASK_STATUS || status === "Closed";

const PLANNER_CALENDAR_MIN_WIDTH = 650;
const UPCOMING_PANEL_MIN_WIDTH = 240;
const UPCOMING_PANEL_MAX_WIDTH = 420;
const PLANNER_SPLIT_HANDLE_WIDTH = 18;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const TASK_DRAG_TYPE = "application/x-planwise-task";

const getCalendarItemType = (item) => item?.itemType || "meeting";

const hasTaskDragData = (event) =>
  Array.from(event.dataTransfer?.types || []).includes(TASK_DRAG_TYPE);

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const labelHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const labelMinutes = minutes.toString().padStart(2, "0");
  const period = hour < 12 ? "AM" : "PM";
  return {
    value: `${hour.toString().padStart(2, "0")}:${labelMinutes}`,
    label: `${labelHour}:${labelMinutes} ${period}`,
  };
});

const getMinutes = (time) => {
  const [hour, minutes] = time.split(":").map(Number);
  return hour * 60 + minutes;
};

const generateRecurringMeetings = (baseMeeting, frequency, daysOfWeek, until) => {
  const meetings = [];
  const startDate = parseLocalDate(baseMeeting.date);
  const endDate = parseLocalDate(until);

  // Expand weekly recurrence into individual meeting instances.
  if (frequency === "Weekly") {
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayName = WEEKDAY_NAMES[date.getDay()];
      if (daysOfWeek.includes(dayName)) {
        const meetingDate = localDateToIso(date);
        const dayLabel = getDayLabelFromIso(meetingDate);
        meetings.push({
          ...baseMeeting,
          id: Date.now() + Math.random(),
          date: meetingDate,
          day: dayLabel,
          recurrence: {
            isRecurring: true,
            frequency,
            daysOfWeek,
            until,
          },
        });
      }
    }
  } else {
    meetings.push({
      ...baseMeeting,
      id: Date.now() + Math.random(),
      recurrence: {
        isRecurring: true,
        frequency,
        daysOfWeek,
        until,
      },
    });
  }
  return meetings;
};

function formatDueDate(dateIso) {
  const date = parseLocalDate(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDayLabelFromIso(dateIso) {
  const date = parseLocalDate(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }
  return formatDateLabel(date);
}

function App() {
  const [activePage, setActivePage] = useState("Planner");
  // Theme preference is stored separately from planner data.
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem("planwise-theme") || "light";
    } catch {
      return "light";
    }
  });
  const [systemTheme, setSystemTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [meetings, setMeetings] = useState(() => {
    try {
      const saved = localStorage.getItem("planwise-meetings");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("planwise-tasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [focusBlocks, setFocusBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem("planwise-focus-blocks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Critical");
  const [newTaskStatus, setNewTaskStatus] = useState(TODO_TASK_STATUS);
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showSmartMeetingModal, setShowSmartMeetingModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingLocation, setNewMeetingLocation] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newMeetingStartTime, setNewMeetingStartTime] = useState("");
  const [newMeetingEndTime, setNewMeetingEndTime] = useState("");
  const [newMeetingAiNotes, setNewMeetingAiNotes] = useState(false);
  const [newMeetingRepeat, setNewMeetingRepeat] = useState(false);
  const [newMeetingFrequency, setNewMeetingFrequency] = useState("Does not repeat");
  const [newMeetingDaysOfWeek, setNewMeetingDaysOfWeek] = useState([]);
  const [newMeetingUntil, setNewMeetingUntil] = useState("");

  // Top-level pages drive the sidebar and active view.
  const pages = [
    "Planner",
    "Tasks",
    "Stats",
    "Time Blocking",
    "Smart Meetings",
    "AI Notes",
    "Calendar Sync",
    "Settings",
  ];

  useEffect(() => {
    // Persist meetings between refreshes.
    localStorage.setItem("planwise-meetings", JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    // Persist tasks between refreshes.
    localStorage.setItem("planwise-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    // Persist task-created calendar blocks separately from meetings.
    localStorage.setItem("planwise-focus-blocks", JSON.stringify(focusBlocks));
  }, [focusBlocks]);

  useEffect(() => {
    // Persist the selected theme mode.
    localStorage.setItem("planwise-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    // Keep System Mode synced with browser preference changes.
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", updateSystemTheme);
    };
  }, []);

  const updateTask = (taskId, updates) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  const openTaskModal = () => {
    // Reset task form for a fresh create flow.
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskPriority("Critical");
    setNewTaskStatus(TODO_TASK_STATUS);
    setNewTaskNotes("");
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    // Hydrate the task modal with the selected card's data.
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title || "");
    setNewTaskDate(task.date || "");
    setNewTaskPriority(task.priority || "Critical");
    setNewTaskStatus(normalizeTaskStatus(task));
    setNewTaskNotes(task.notes || "");
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskPriority("Critical");
    setNewTaskStatus(TODO_TASK_STATUS);
    setNewTaskNotes("");
    setEditingTaskId(null);
  };

  const handleSaveTask = () => {
    if (!newTaskTitle.trim() || !newTaskDate) {
      alert("Please fill in the task title and due date.");
      return;
    }

    const taskDate = new Date(newTaskDate);
    if (Number.isNaN(taskDate.getTime())) {
      alert("Please enter a valid due date.");
      return;
    }

    const updatedTask = {
      title: newTaskTitle.trim(),
      date: newTaskDate,
      priority: newTaskPriority,
      notes: newTaskNotes.trim(),
      status: newTaskStatus,
      completed: isCompletedTaskStatus(newTaskStatus),
    };

    // Update an existing task or append a new one.
    if (editingTaskId) {
      updateTask(editingTaskId, updatedTask);
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...updatedTask,
        },
      ]);
    }

    closeTaskModal();
  };

  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const handleClearDemoData = () => {
    const confirmed = window.confirm(
      "Clear all demo meetings, tasks, and focus blocks from this browser?"
    );

    if (!confirmed) return;

    localStorage.removeItem("planwise-meetings");
    localStorage.removeItem("planwise-tasks");
    localStorage.removeItem("planwise-focus-blocks");
    setMeetings([]);
    setTasks([]);
    setFocusBlocks([]);
    setSelectedMeeting(null);
  };

  const openSmartMeetingModal = () => setShowSmartMeetingModal(true);
  const closeSmartMeetingModal = () => {
    // Reset smart meeting form state when the modal closes.
    setShowSmartMeetingModal(false);
    setNewMeetingTitle("");
    setNewMeetingLocation("");
    setNewMeetingDate("");
    setNewMeetingStartTime("");
    setNewMeetingEndTime("");
    setNewMeetingAiNotes(false);
    setNewMeetingRepeat(false);
    setNewMeetingFrequency("Does not repeat");
    setNewMeetingDaysOfWeek([]);
    setNewMeetingUntil("");
  };

  const handleSaveMeeting = () => {
    if (!newMeetingTitle || !newMeetingDate || !newMeetingStartTime || !newMeetingEndTime) {
      alert("Please fill in the meeting title, date, start time, and end time.");
      return;
    }

    const selectedDate = parseLocalDate(newMeetingDate);
    if (Number.isNaN(selectedDate.getTime())) {
      alert("Please choose a valid date.");
      return;
    }

    const startMinutes = getMinutes(newMeetingStartTime);
    const endMinutes = getMinutes(newMeetingEndTime);

    if (endMinutes <= startMinutes) {
      alert("End time must be after start time.");
      return;
    }

    if (newMeetingRepeat) {
      if (!newMeetingUntil) {
        alert("Please select a repeat until date.");
        return;
      }
      if (newMeetingDaysOfWeek.length === 0) {
        alert("Please select at least one weekday.");
        return;
      }
      const untilDate = parseLocalDate(newMeetingUntil);
      if (untilDate < selectedDate) {
        alert("Repeat until date must be after or equal to the meeting date.");
        return;
      }
    }

    let newMeetings = [];
    const formattedStartDate = localDateToIso(selectedDate);
    const meetingTimeText = `${timeOptions.find((time) => time.value === newMeetingStartTime)?.label} - ${timeOptions.find((time) => time.value === newMeetingEndTime)?.label}`;
    // Create either one meeting or the generated recurring series.
    if (newMeetingRepeat) {
      const baseMeeting = {
        id: Date.now(),
        title: newMeetingTitle,
        location: newMeetingLocation.trim() ? newMeetingLocation.trim() : "No location added",
        date: formattedStartDate,
        day: getDayLabelFromIso(formattedStartDate),
        startTime: newMeetingStartTime,
        endTime: newMeetingEndTime,
        startHour: startMinutes / 60,
        duration: (endMinutes - startMinutes) / 60,
        aiNotes: newMeetingAiNotes,
        time: meetingTimeText,
      };
      newMeetings = generateRecurringMeetings(baseMeeting, newMeetingFrequency, newMeetingDaysOfWeek, newMeetingUntil);
    } else {
      const newMeeting = {
        id: Date.now(),
        title: newMeetingTitle,
        location: newMeetingLocation.trim() ? newMeetingLocation.trim() : "No location added",
        date: formattedStartDate,
        day: getDayLabelFromIso(formattedStartDate),
        startTime: newMeetingStartTime,
        endTime: newMeetingEndTime,
        startHour: startMinutes / 60,
        duration: (endMinutes - startMinutes) / 60,
        aiNotes: newMeetingAiNotes,
        time: meetingTimeText,
      };
      newMeetings = [newMeeting];
    }

    setMeetings((prev) => [...prev, ...newMeetings]);
    closeSmartMeetingModal();
  };

  const openSmartMeetingAt = (dateIso, startTime) => {
    // Pre-fill the meeting modal from a clicked calendar slot.
    const startIndex = timeOptions.findIndex((opt) => opt.value === startTime);
    const endIndex = Math.min(startIndex + 2, timeOptions.length - 1);
    const endTime = timeOptions[endIndex]?.value || startTime;

    setNewMeetingDate(dateIso);
    setNewMeetingStartTime(startTime);
    setNewMeetingEndTime(endTime);
    setNewMeetingTitle("");
    setNewMeetingLocation("");
    setNewMeetingAiNotes(false);
    setNewMeetingRepeat(false);
    setNewMeetingFrequency("Does not repeat");
    setNewMeetingDaysOfWeek([]);
    setNewMeetingUntil("");
    setShowSmartMeetingModal(true);
  };

  return (
    <div
      className={`app theme-${
        themeMode === "system" ? systemTheme : themeMode
      } theme-selection-${themeMode}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">P</div>
          <div>
            <h2>PlanWISE AI</h2>
            <p>Smart Planner</p>
          </div>
        </div>

        <nav className="nav">
          {pages.map((page) => (
            <button
              key={page}
              className={activePage === page ? "active" : ""}
              onClick={() => setActivePage(page)}
              onDragOver={(event) => {
                if (page !== "Planner" || !hasTaskDragData(event)) return;
                event.preventDefault();
                setActivePage("Planner");
              }}
            >
              {page}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
            <p>{getPageDescription(activePage)}</p>
          </div>

          {activePage !== "Settings" && (
            <div className="topbar-actions">
              <button
                className="topbar-btn"
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              >
                + Create
              </button>
              {showCreateDropdown && (
                <div className="create-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowCreateDropdown(false);
                      openTaskModal();
                    }}
                  >
                    Task
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowCreateDropdown(false);
                      openSmartMeetingModal();
                    }}
                  >
                    Smart Meeting
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="page-content">
          {activePage === "Planner" && (
            <PlannerPage
              meetings={meetings}
              setMeetings={setMeetings}
              focusBlocks={focusBlocks}
              setFocusBlocks={setFocusBlocks}
              selectedMeeting={selectedMeeting}
              setSelectedMeeting={setSelectedMeeting}
              onCreateMeetingAt={openSmartMeetingAt}
              tasks={tasks}
              onEditTask={openEditTaskModal}
            />
          )}
          {activePage === "Tasks" && (
            <TasksPage
              tasks={tasks}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={updateTask}
              onEditTask={openEditTaskModal}
            />
          )}
          {activePage === "Stats" && <StatsPage />}
          {activePage === "Time Blocking" && <TimeBlockingPage />}
          {activePage === "Smart Meetings" && (
            <SmartMeetingsPage setMeetings={setMeetings} />
          )}
          {activePage === "AI Notes" && <AINotesPage meetings={meetings} />}
          {activePage === "Calendar Sync" && <CalendarSyncPage />}
          {activePage === "Settings" && (
            <SettingsPage
              themeMode={themeMode}
              onThemeChange={setThemeMode}
              onClearDemoData={handleClearDemoData}
            />
          )}
        </div>
        {showTaskModal && (
          <div className="meeting-modal-overlay">
            <div className="meeting-modal">
              <h3>{editingTaskId ? "Edit Task" : "New Task"}</h3>
              <div className="form-box">
                <input
                  placeholder="Task title"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />

                <input
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                />

                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>

                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value)}
                >
                  {TASK_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <textarea
                  placeholder="Notes"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                />

                <div className="modal-actions">
                  {editingTaskId && (
                    <button
                      className="secondary-btn task-delete-btn"
                      onClick={() => {
                        handleDeleteTask(editingTaskId);
                        closeTaskModal();
                      }}
                    >
                      Delete
                    </button>
                  )}
                  <button className="secondary-btn" onClick={closeTaskModal}>
                    {editingTaskId ? "Close" : "Cancel"}
                  </button>
                  <button className="primary-btn" onClick={handleSaveTask}>
                    {editingTaskId ? "Save Changes" : "Save Task"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showSmartMeetingModal && (
          <div className="meeting-modal-overlay">
            <div className="meeting-modal">
              <h3>New Smart Meeting</h3>
              <div className="form-box">
                <input
                  placeholder="Meeting title"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                />

                <input
                  placeholder="Meeting location"
                  value={newMeetingLocation}
                  onChange={(e) => setNewMeetingLocation(e.target.value)}
                />

                <input
                  type="date"
                  value={newMeetingDate}
                  onChange={(e) => setNewMeetingDate(e.target.value)}
                />

                <select
                  value={newMeetingStartTime}
                  onChange={(e) => setNewMeetingStartTime(e.target.value)}
                >
                  <option value="">Select start time</option>
                  {timeOptions.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>

                <select
                  value={newMeetingEndTime}
                  onChange={(e) => setNewMeetingEndTime(e.target.value)}
                >
                  <option value="">Select end time</option>
                  {timeOptions.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={newMeetingAiNotes}
                    onChange={(e) => setNewMeetingAiNotes(e.target.checked)}
                  />
                  Enable AI Notes
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={newMeetingRepeat}
                    onChange={(e) => setNewMeetingRepeat(e.target.checked)}
                  />
                  Repeat this meeting
                </label>

                {newMeetingRepeat && (
                  <>
                    <select
                      value={newMeetingFrequency}
                      onChange={(e) => setNewMeetingFrequency(e.target.value)}
                    >
                      <option value="Does not repeat">Does not repeat</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                    </select>

                    <label className="form-label">Repeat on</label>
                    <div className="weekday-chip-row">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => {
                        const selected = newMeetingDaysOfWeek.includes(day);
                        return (
                          <label
                            key={day}
                            className={`weekday-chip ${selected ? "selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewMeetingDaysOfWeek([...newMeetingDaysOfWeek, day]);
                                } else {
                                  setNewMeetingDaysOfWeek(newMeetingDaysOfWeek.filter((d) => d !== day));
                                }
                              }}
                            />
                            <span>{day}</span>
                          </label>
                        );
                      })}
                    </div>

                    <label className="form-label">Repeat until</label>
                    <input
                      type="date"
                      value={newMeetingUntil}
                      onChange={(e) => setNewMeetingUntil(e.target.value)}
                      placeholder="Repeat until"
                    />
                  </>
                )}

                <div className="modal-actions">
                  <button className="secondary-btn" onClick={closeSmartMeetingModal}>
                    Cancel
                  </button>
                  <button className="primary-btn" onClick={handleSaveMeeting}>
                    Save Meeting
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function getPageDescription(page) {
  const descriptions = {
    Planner: "Plan your day with AI-powered focus blocks and smart meetings.",
    Tasks: "Track tasks by priority, progress, and completion.",
    Priorities: "Organize tasks by urgency, importance, and deadlines.",
    Stats: "View productivity insights, focus time, and meeting trends.",
    "Time Blocking": "Create structured work sessions around your calendar.",
    "Smart Meetings": "Schedule meetings and prepare AI-powered summaries.",
    "AI Notes": "Capture meeting notes, summaries, decisions, and action items.",
    "Calendar Sync": "Connect Google Calendar and Outlook Calendar.",
    Settings: "Manage your preferences, theme, and integrations.",
  };

  return descriptions[page];
}

function PlannerPage({
  meetings,
  setMeetings,
  focusBlocks,
  setFocusBlocks,
  selectedMeeting,
  setSelectedMeeting,
  onCreateMeetingAt,
  tasks,
  onEditTask,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editAiNotes, setEditAiNotes] = useState(false);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [dragState, setDragState] = useState(null);
  const [splitDragState, setSplitDragState] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [upcomingPanelWidth, setUpcomingPanelWidth] = useState(() => {
    try {
      const savedWidth = Number(localStorage.getItem("planwise-upcoming-panel-width"));
      if (!Number.isFinite(savedWidth)) return 280;
      return clamp(savedWidth, UPCOMING_PANEL_MIN_WIDTH, UPCOMING_PANEL_MAX_WIDTH);
    } catch {
      return 280;
    }
  });
  const plannerSplitRef = useRef(null);

  const todayIso = getDateKey(new Date());

  // Build the visible week for the planner grid.
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(visibleWeekStart);
    date.setDate(date.getDate() + index);
    const iso = getDateKey(date);
    return {
      date,
      iso,
      label: formatDateLabel(date),
      isToday: iso === todayIso,
    };
  });

  const hours = [
    "12 AM", "12:30 AM", "1 AM", "1:30 AM", "2 AM", "2:30 AM",
    "3 AM", "3:30 AM", "4 AM", "4:30 AM", "5 AM", "5:30 AM",
    "6 AM", "6:30 AM", "7 AM", "7:30 AM", "8 AM", "8:30 AM",
    "9 AM", "9:30 AM", "10 AM", "10:30 AM", "11 AM", "11:30 AM",
    "12 PM", "12:30 PM", "1 PM", "1:30 PM", "2 PM", "2:30 PM",
    "3 PM", "3:30 PM", "4 PM", "4:30 PM", "5 PM", "5:30 PM",
    "6 PM", "6:30 PM", "7 PM", "7:30 PM", "8 PM", "8:30 PM",
    "9 PM", "9:30 PM", "10 PM", "10:30 PM", "11 PM", "11:30 PM",
  ];

  const timeOptions = useMemo(
    () =>
      Array.from({ length: 96 }, (_, index) => {
        const totalMinutes = index * 15;
        const hour = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const labelHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const labelMinutes = minutes.toString().padStart(2, "0");
        const period = hour < 12 ? "AM" : "PM";

        return {
          value: `${hour.toString().padStart(2, "0")}:${labelMinutes}`,
          label: `${labelHour}:${labelMinutes} ${period}`,
        };
      }),
    []
  );

  const getMinutes = (time) => {
    const [hour, minutes] = time.split(":").map(Number);
    return hour * 60 + minutes;
  };

  const getDayEvents = (dayIso, dayLabel) => {
    // Merge meetings and task-created focus blocks for calendar rendering.
    const calendarItems = [
      ...meetings.map((meeting) => ({ ...meeting, itemType: "meeting" })),
      ...focusBlocks.map((focusBlock) => ({
        ...focusBlock,
        itemType: "focus",
      })),
    ];

    const dayItems = calendarItems
      .filter(
        (item) =>
          item.date === dayIso ||
          (!item.date && item.day === dayLabel)
      )
      .map((item) => {
        const start = item.startHour != null
          ? item.startHour * 60
          : getMinutes(item.startTime);
        const duration = item.duration != null
          ? item.duration
          : (getMinutes(item.endTime) - start) / 60;
        const end = start + duration * 60;
        return {
          meeting: item,
          start,
          end,
          duration,
          column: 0,
          maxOverlap: 1,
        };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const columns = [];
    // Assign overlap columns so simultaneous events can sit side by side.
    dayItems.forEach((item) => {
      const freeIndex = columns.findIndex((end) => end <= item.start);
      if (freeIndex >= 0) {
        item.column = freeIndex;
        columns[freeIndex] = item.end;
      } else {
        item.column = columns.length;
        columns.push(item.end);
      }
    });

    dayItems.forEach((item) => {
      const overlappingEvents = dayItems.filter(
        (other) => other.start < item.end && other.end > item.start
      );
      item.maxOverlap = overlappingEvents.length;
    });

    return dayItems;
  };

  const getDayTasks = (dayIso) => {
    // Show unfinished due-date tasks as subtle chips above each day.
    return (tasks || [])
      .filter(
        (task) =>
          task.date === dayIso &&
          !task.completed &&
          !isCompletedTaskStatus(task.status)
      )
      .sort(
        (a, b) =>
          TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority)
      );
  };

  const getDropSlot = (event) => {
    // Convert a pointer position into the nearest calendar half-hour slot.
    const bounds = event.currentTarget.getBoundingClientRect();
    const headerHeight = 54;
    const clickY = event.clientY - bounds.top - headerHeight;
    if (clickY < 0) return null;
    const halfHourStep = Math.min(47, Math.max(0, Math.floor(clickY / 32)));
    const startIndex = halfHourStep * 2;
    const startTimeOpt = timeOptions[startIndex];
    if (!startTimeOpt) return null;
    return { halfHourStep, startIndex, startTimeOpt };
  };

  const handleTaskDragOverDay = (event, dayIso) => {
    // Highlight the active calendar slot while dragging a task.
    if (!hasTaskDragData(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const slot = getDropSlot(event);
    if (!slot) return;
    setDragOverSlot(`${dayIso}-${slot.halfHourStep}`);
  };

  const handleTaskDropOnDay = (event, day) => {
    // Copy a task into the calendar as a focus block.
    if (!hasTaskDragData(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOverSlot(null);

    const slot = getDropSlot(event);
    if (!slot) return;

    let draggedTask = null;
    try {
      draggedTask = JSON.parse(event.dataTransfer.getData(TASK_DRAG_TYPE));
    } catch {
      draggedTask = null;
    }

    if (!draggedTask?.title) return;

    const endIndex = Math.min(slot.startIndex + 4, timeOptions.length - 1);
    const endTimeOpt = timeOptions[endIndex];
    const startMinutes = getMinutes(slot.startTimeOpt.value);
    const endMinutes = getMinutes(endTimeOpt.value);
    const durationMinutes = Math.max(30, endMinutes - startMinutes);

    const focusBlock = {
      id: Date.now(),
      itemType: "focus",
      taskId: draggedTask.id,
      title: draggedTask.title,
      location: "Focus Block",
      date: day.iso,
      day: getDayLabelFromIso(day.iso),
      startTime: slot.startTimeOpt.value,
      endTime: endTimeOpt.value,
      startHour: startMinutes / 60,
      duration: durationMinutes / 60,
      aiNotes: false,
      time: `${slot.startTimeOpt.label} - ${endTimeOpt.label}`,
    };

    setFocusBlocks((prev) => [...prev, focusBlock]);
  };

  const upcomingMeetings = meetings
    .filter((meeting) => {
      // Keep the upcoming panel focused on future meetings and search matches.
      if (!meeting.date) return false;
      const meetingDate = parseLocalDate(meeting.date);
      if (Number.isNaN(meetingDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (meetingDate < today) return false;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        meeting.title.toLowerCase().includes(query) ||
        meeting.location.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aDate = parseLocalDate(a.date);
      const bDate = parseLocalDate(b.date);
      if (aDate.getTime() !== bDate.getTime()) {
        return aDate - bDate;
      }
      const aStart = a.startHour != null ? a.startHour * 60 : getMinutes(a.startTime);
      const bStart = b.startHour != null ? b.startHour * 60 : getMinutes(b.startTime);
      return aStart - bStart;
    })
    .slice(0, 5);

  useEffect(() => {
    if (!dragState) return;

    // Handle vertical resizing for calendar events.
    const handleMouseMove = (event) => {
      event.preventDefault();
      if (!dragState) return;

      const deltaY = event.clientY - dragState.startY;
      const stepChange = Math.round(deltaY / 32);
      const rawHalfHours = Math.round((dragState.initialDurationMinutes + stepChange * 30) / 30);
      const minHalfHours = 1;
      const maxHalfHours = Math.floor((95 - dragState.startIndex) / 2);
      const halfHours = Math.max(minHalfHours, Math.min(maxHalfHours, rawHalfHours));
      const endIndex = dragState.startIndex + halfHours * 2;
      const endOption = timeOptions[endIndex];
      if (!endOption) return;

      const startOption = timeOptions[dragState.startIndex];
      const updatedDuration = halfHours * 30;
      const updatedTimeLabel = `${startOption?.label || ""} - ${endOption.label}`;

      const updateCalendarItem = (item) => {
        if (item.id !== dragState.meetingId) return item;
        return {
          ...item,
          duration: updatedDuration / 60,
          endTime: endOption.value,
          time: updatedTimeLabel,
        };
      };

      if (dragState.itemType === "focus") {
        setFocusBlocks((prev) => prev.map(updateCalendarItem));
      } else {
        setMeetings((prev) => prev.map(updateCalendarItem));
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, setFocusBlocks, setMeetings, timeOptions]);

  useEffect(() => {
    // Persist the user's planner split preference.
    localStorage.setItem(
      "planwise-upcoming-panel-width",
      String(upcomingPanelWidth)
    );
  }, [upcomingPanelWidth]);

  useEffect(() => {
    if (!splitDragState) return;

    // Handle planner panel resizing.
    const handlePointerMove = (event) => {
      event.preventDefault();
      const deltaX = event.clientX - splitDragState.startX;
      const maxWidthFromLayout = Math.max(
        UPCOMING_PANEL_MIN_WIDTH,
        splitDragState.containerWidth -
          PLANNER_CALENDAR_MIN_WIDTH -
          PLANNER_SPLIT_HANDLE_WIDTH
      );
      const maxWidth = Math.min(UPCOMING_PANEL_MAX_WIDTH, maxWidthFromLayout);
      const nextWidth = clamp(
        splitDragState.startWidth - deltaX,
        UPCOMING_PANEL_MIN_WIDTH,
        maxWidth
      );

      setUpcomingPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setSplitDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [splitDragState]);

  const startSplitResize = (event) => {
    // Capture initial split dimensions before dragging the handle.
    event.preventDefault();
    event.stopPropagation();

    const containerWidth =
      plannerSplitRef.current?.getBoundingClientRect().width ||
      PLANNER_CALENDAR_MIN_WIDTH +
        PLANNER_SPLIT_HANDLE_WIDTH +
        upcomingPanelWidth;

    setSplitDragState({
      startX: event.clientX,
      startWidth: upcomingPanelWidth,
      containerWidth,
    });
  };

  const openEdit = () => {
    if (!selectedMeeting) return;

    // Hydrate the shared calendar item modal for editing.
    setEditTitle(selectedMeeting.title || "");
    setEditLocation(selectedMeeting.location || "");
    setEditStartTime(selectedMeeting.startTime || "");
    setEditEndTime(selectedMeeting.endTime || "");
    setEditAiNotes(Boolean(selectedMeeting.aiNotes));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedMeeting) return;

    if (!editTitle || !editStartTime || !editEndTime) {
      alert("Please fill in a title, start time, and end time.");
      return;
    }

    const startMinutes = getMinutes(editStartTime);
    const endMinutes = getMinutes(editEndTime);

    if (endMinutes <= startMinutes) {
      alert("End time must be after start time.");
      return;
    }

    const startHour = startMinutes / 60;
    const duration = (endMinutes - startMinutes) / 60;

    const startLabel = timeOptions.find((time) => time.value === editStartTime)?.label;
    const endLabel = timeOptions.find((time) => time.value === editEndTime)?.label;

    const updatedMeeting = {
      ...selectedMeeting,
      title: editTitle,
      location: editLocation.trim() ? editLocation.trim() : "No location added",
      startTime: editStartTime,
      endTime: editEndTime,
      startHour,
      duration,
      aiNotes: editAiNotes,
      time: `${startLabel} - ${endLabel}`,
    };

    // Save changes back to the correct calendar collection.
    if (getCalendarItemType(selectedMeeting) === "focus") {
      setFocusBlocks((prev) =>
        prev.map((focusBlock) =>
          focusBlock.id === selectedMeeting.id ? updatedMeeting : focusBlock
        )
      );
    } else {
      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === selectedMeeting.id ? updatedMeeting : meeting
        )
      );
    }

    setSelectedMeeting(updatedMeeting);
    setIsEditing(false);
  };

  const handleDelete = () => {
    // Delete either a meeting or focus block from its source collection.
    if (getCalendarItemType(selectedMeeting) === "focus") {
      setFocusBlocks((prev) =>
        prev.filter((focusBlock) => focusBlock.id !== selectedMeeting.id)
      );
    } else {
      setMeetings((prev) =>
        prev.filter((meeting) => meeting.id !== selectedMeeting.id)
      );
    }
    setSelectedMeeting(null);
    setIsEditing(false);
  };

  const handleClose = () => {
    setSelectedMeeting(null);
    setIsEditing(false);
  };

  return (
    <section className="planner-card">
      <div className="calendar-header">
        <div>
          <h2>{formatMonthYear(weekDays[0].date, weekDays[6].date)}</h2>
          <p>
            {weekDays[0].label} - {weekDays[6].label}
          </p>
        </div>

        <div className="calendar-header-actions">
          <button
            className="secondary-btn"
            onClick={() =>
              setVisibleWeekStart((current) => {
                const next = new Date(current);
                next.setDate(current.getDate() - 7);
                return getStartOfWeek(next);
              })
            }
          >
            Previous Week
          </button>
          <button
            className="secondary-btn"
            onClick={() => setVisibleWeekStart(getStartOfWeek(new Date()))}
          >
            Today
          </button>
          <button
            className="secondary-btn"
            onClick={() =>
              setVisibleWeekStart((current) => {
                const next = new Date(current);
                next.setDate(current.getDate() + 7);
                return getStartOfWeek(next);
              })
            }
          >
            Next Week
          </button>
        </div>
      </div>

      <div
        className={`planner-main-grid ${splitDragState ? "is-resizing" : ""}`}
        ref={plannerSplitRef}
        style={{
          "--upcoming-panel-width": `${upcomingPanelWidth}px`,
        }}
      >
        <div className="calendar-layout">
          <div className="time-column">
            <div className="corner-cell"></div>
            {hours.map((hour) => (
              <div className="time-slot" key={hour}>
                {hour}
              </div>
            ))}
          </div>

          <div className="calendar-days">
            {weekDays.map((day) => {
              const dayTasks = getDayTasks(day.iso);
              return (
                // Render weekly calendar columns with click and drop targets.
                <div
                  className={`day-column ${day.isToday ? "today-column" : ""} ${
                    dragOverSlot?.startsWith(`${day.iso}-`) ? "task-drop-active" : ""
                  }`}
                  key={day.iso}
                  style={{
                    "--drop-slot-top": dragOverSlot?.startsWith(`${day.iso}-`)
                      ? `${54 + Number(dragOverSlot.split("-").pop()) * 32}px`
                      : "54px",
                  }}
                  onDragOver={(event) => handleTaskDragOverDay(event, day.iso)}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setDragOverSlot(null);
                    }
                  }}
                  onDrop={(event) => handleTaskDropOnDay(event, day)}
                  onClick={(event) => {
                    const target = event.currentTarget;
                    const bounds = target.getBoundingClientRect();
                    const headerHeight = 54;
                    const clickY = event.clientY - bounds.top - headerHeight;
                    if (clickY < 0) return;
                    const halfHourStep = Math.min(47, Math.floor(clickY / 32));
                    const startTimeOpt = timeOptions[halfHourStep * 2];
                    if (!startTimeOpt) return;
                    onCreateMeetingAt(day.iso, startTimeOpt.value);
                  }}
                >
                  <div className={`day-title ${day.isToday ? "day-title-today" : ""}`}>
                    <span>{day.label}</span>
                    {day.isToday && <span className="today-pill">Today</span>}
                  </div>

                  {dayTasks.length > 0 && (
                    <div className="calendar-task-list">
                      {dayTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="calendar-task-card clickable-event"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditTask(task);
                          }}
                        >
                          <span className="calendar-task-dot" aria-hidden="true" />
                          <span className="calendar-task-card-title">
                            {task.title}
                          </span>
                          <span className="calendar-task-label">Task</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {hours.map((hour) => (
                    <div className="calendar-hour" key={hour}></div>
                  ))}

                {getDayEvents(day.iso, day.label).map((item) => {
                  const calendarStartMinutes = 0;
                  const offsetMinutes = item.start - calendarStartMinutes;
                  const cellWidth = 100 / item.maxOverlap;
                  const gapWidth = item.maxOverlap > 1 ? 1.5 : 0;
                  const width = cellWidth - gapWidth;
                  const left = item.column * cellWidth + (gapWidth / 2);
                  const itemType = getCalendarItemType(item.meeting);

                  return (
                    <div
                      key={`${itemType}-${item.meeting.id}`}
                      className={`event ${itemType === "focus" ? "focus-block" : "meeting"} clickable-event ${
                        item.duration <= 0.5 ? "event-compact" : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedMeeting(item.meeting);
                      }}
                      style={{
                        top: `calc(54px + ${(offsetMinutes / 30) * 32}px)`,
                        height: `${Math.max((item.duration * 60 / 30) * 32, 64)}px`,
                        width: `${width}%`,
                        left: `${left}%`,
                        position: "absolute",
                        overflow: "hidden",
                      }}
                    >
                      <span className="event-title">{item.meeting.title}</span>
                      <span className="event-time">{item.meeting.time}</span>
                      {itemType === "focus" && (
                        <span className="event-note">Focus Block</span>
                      )}
                      {itemType === "meeting" && item.meeting.aiNotes && (
                        <span className="event-note">AI Notes On</span>
                      )}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: "10px",
                          cursor: "ns-resize",
                          background: "rgba(15, 23, 42, 0.08)",
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          const startIndex = timeOptions.findIndex(
                            (opt) => opt.value === item.meeting.startTime
                          );
                          if (startIndex < 0) return;
                          const initialDurationMinutes = item.meeting.duration != null
                            ? item.meeting.duration * 60
                            : getMinutes(item.meeting.endTime) - getMinutes(item.meeting.startTime);
                          setDragState({
                            meetingId: item.meeting.id,
                            itemType,
                            startY: event.clientY,
                            initialDurationMinutes,
                            startIndex,
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>

        <button
          type="button"
          className="planner-resize-handle"
          aria-label="Resize upcoming meetings panel"
          onPointerDown={startSplitResize}
        >
          <span aria-hidden="true" />
        </button>

        <aside className="upcoming-panel">
          <div className="upcoming-header">
            <h3>Upcoming Meetings</h3>
            <p>Next 5 meetings by date and time.</p>
          </div>
          <input
            className="upcoming-search"
            placeholder="Search by title or location"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="upcoming-list">
            {upcomingMeetings.length === 0 ? (
              <p className="empty-text">No upcoming meetings found.</p>
            ) : (
              upcomingMeetings.map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  className="upcoming-item clickable-event"
                  aria-label={`Open details for ${meeting.title}`}
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  <div className="upcoming-item-header">
                    <h4 className="upcoming-item-title">{meeting.title}</h4>
                    <span className="upcoming-pill">
                      {meeting.aiNotes ? "AI Notes" : "No AI Notes"}
                    </span>
                  </div>
                  <p className="upcoming-item-subtitle">
                    {meeting.day || getDayLabelFromIso(meeting.date)} • {meeting.time}
                  </p>
                  <div className="upcoming-item-meta">
                    <span>{formatDueDate(meeting.date)}</span>
                    <span>{meeting.location || "No location added"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {selectedMeeting && (
        <div className="meeting-modal-overlay">
          <div className="meeting-modal">
            {isEditing ? (
              <>
                <h3>
                  Edit {getCalendarItemType(selectedMeeting) === "focus" ? "Focus Block" : "Meeting"}
                </h3>

                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={
                    getCalendarItemType(selectedMeeting) === "focus"
                      ? "Focus block title"
                      : "Meeting title"
                  }
                />

                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder={
                    getCalendarItemType(selectedMeeting) === "focus"
                      ? "Focus block label"
                      : "Meeting location"
                  }
                />

                <select
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                >
                  <option value="">Select start time</option>
                  {timeOptions.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>

                <select
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                >
                  <option value="">Select end time</option>
                  {timeOptions.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>

                {getCalendarItemType(selectedMeeting) === "meeting" && (
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={editAiNotes}
                      onChange={(e) => setEditAiNotes(e.target.checked)}
                    />
                    Enable AI Notes
                  </label>
                )}
              </>
            ) : (
              <>
                <h3>{selectedMeeting.title}</h3>
                <p>
                  <strong>Type:</strong>{" "}
                  {getCalendarItemType(selectedMeeting) === "focus"
                    ? "Focus Block"
                    : "Meeting"}
                </p>
                <p>
                  <strong>Day:</strong>{" "}
                  {selectedMeeting.day || getDayLabelFromIso(selectedMeeting.date)}
                </p>
                <p>
                  <strong>Date:</strong> {formatDueDate(selectedMeeting.date)}
                </p>
                <p>
                  <strong>Time:</strong> {selectedMeeting.time}
                </p>
                {getCalendarItemType(selectedMeeting) === "meeting" ? (
                  <>
                    <p>
                      <strong>Location:</strong>{" "}
                      {selectedMeeting.location || "No location added"}
                    </p>
                    <p>
                      <strong>AI Notes:</strong>{" "}
                      {selectedMeeting.aiNotes ? "Enabled" : "Disabled"}
                    </p>
                  </>
                ) : (
                  <p>
                    <strong>Source:</strong>{" "}
                    {selectedMeeting.location || "Task focus block"}
                  </p>
                )}
                {getCalendarItemType(selectedMeeting) === "meeting" && selectedMeeting.recurrence && (
                  <p>
                    <strong>Recurring:</strong> {selectedMeeting.recurrence.frequency} on {selectedMeeting.recurrence.daysOfWeek.join(", ")} until {formatDueDate(selectedMeeting.recurrence.until)}
                  </p>
                )}
              </>
            )}

            <div className="modal-actions">
              {isEditing ? (
                <>
                  <button className="secondary-btn" onClick={handleSaveEdit}>
                    Save
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button className="secondary-btn" onClick={openEdit}>
                  Edit
                </button>
              )}

              <button className="secondary-btn" onClick={handleDelete}>
                Delete
              </button>

              <button className="primary-btn" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TasksPage({ tasks, onDeleteTask, onUpdateTask, onEditTask }) {
  const suppressTaskClickRef = useRef(false);

  // Group tasks by current labels while honoring legacy saved statuses.
  const groupedTasks = TASK_STATUS_COLUMNS.reduce((acc, column) => {
    acc[column.value] = [];
    return acc;
  }, {});

  tasks.forEach((task) => {
    const status = normalizeTaskStatus(task);
    groupedTasks[status].push(task);
  });

  const handleDrop = (event, column) => {
    // Move tasks between board columns without changing their content.
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const id = Number(taskId);
    if (column.value === COMPLETED_TASK_STATUS) {
      onUpdateTask(id, { completed: true, status: COMPLETED_TASK_STATUS });
    } else {
      onUpdateTask(id, { completed: false, status: column.value });
    }
  };

  const handleDragStart = (event, task) => {
    // Include both board move data and calendar focus-block data.
    suppressTaskClickRef.current = true;
    event.dataTransfer.setData("text/plain", String(task.id));
    event.dataTransfer.setData(
      TASK_DRAG_TYPE,
      JSON.stringify({
        id: task.id,
        title: task.title,
      })
    );
    event.dataTransfer.effectAllowed = "copyMove";
  };

  const handlePriorityChange = (taskId, priority) => {
    onUpdateTask(taskId, { priority });
  };

  return (
    <section className="tasks-board">
      {TASK_STATUS_COLUMNS.map((column) => (
        <div
          key={column.value}
          className={`tasks-column tasks-column-${column.value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, column)}
        >
          <div className="tasks-column-header">
            <h3>{column.value}</h3>
            {column.value === COMPLETED_TASK_STATUS && (
              <span className="tasks-column-count">
                {groupedTasks[COMPLETED_TASK_STATUS].length}
              </span>
            )}
          </div>
          {groupedTasks[column.value].length === 0 ? (
            <div className="board-empty-state">
              <h4>No {column.value.toLowerCase()} tasks</h4>
              <p>{column.emptyText}</p>
            </div>
          ) : (
            groupedTasks[column.value].map((task) => {
              const taskIsCompleted =
                task.completed || normalizeTaskStatus(task) === COMPLETED_TASK_STATUS;
              return (
              <div
                key={task.id}
                className={`task-card task-card-drag task-card-${column.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")} ${taskIsCompleted ? "task-completed" : ""}`}
                draggable
                onDragStart={(event) => handleDragStart(event, task)}
                onDragEnd={() => {
                  window.setTimeout(() => {
                    suppressTaskClickRef.current = false;
                  }, 0);
                }}
                onClick={() => {
                  if (suppressTaskClickRef.current) return;
                  onEditTask(task);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEditTask(task);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="task-card-top">
                  <div className="task-card-title-wrap">
                    <strong className={taskIsCompleted ? "task-title-closed" : ""}>
                      {task.title}
                    </strong>
                    {taskIsCompleted && (
                      <span className="task-status-pill">Completed</span>
                    )}
                  </div>
                </div>
                <p className="task-card-meta">Due {formatDueDate(task.date)}</p>
                {task.notes && <p className="task-card-note">{task.notes}</p>}
                <div className="task-card-bottom">
                  <span className="task-priority-chip">{task.priority}</span>
                </div>
              </div>
            );
            })
          )}
        </div>
      ))}
    </section>
  );
}

function StatsPage() {
  return (
    <section className="stats-grid">
      <div className="stat-card">
        <h3>Focus Time</h3>
        <p className="stat-number">13h</p>
      </div>
      <div className="stat-card">
        <h3>Meetings</h3>
        <p className="stat-number">4</p>
      </div>
      <div className="stat-card">
        <h3>Tasks Completed</h3>
        <p className="stat-number">72%</p>
      </div>
    </section>
  );
}

function TimeBlockingPage() {
  return (
    <section className="empty-card">
      <h2>AI Time Blocking</h2>
      <p>PlanWISE AI will suggest focus blocks based on your tasks and calendar.</p>
      <button className="primary-btn">Generate Focus Blocks</button>
    </section>
  );
}

function SmartMeetingsPage({ setMeetings }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [aiNotes, setAiNotes] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState("Does not repeat");
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [until, setUntil] = useState("");

  const timeOptions = Array.from({ length: 96 }, (_, index) => {
    const totalMinutes = index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const labelHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const labelMinutes = minutes.toString().padStart(2, "0");
    const period = hour < 12 ? "AM" : "PM";

    return {
      value: `${hour.toString().padStart(2, "0")}:${labelMinutes}`,
      label: `${labelHour}:${labelMinutes} ${period}`,
    };
  });

  const getMinutes = (time) => {
    const [hour, minutes] = time.split(":").map(Number);
    return hour * 60 + minutes;
  };

  const handleCreate = () => {
    if (!title || !date || !startTime || !endTime) {
      alert("Please fill in the meeting title, date, start time, and end time.");
      return;
    }

    const selectedDate = new Date(date);
    if (Number.isNaN(selectedDate.getTime())) {
      alert("Please choose a valid date.");
      return;
    }

    const startMinutes = getMinutes(startTime);
    const endMinutes = getMinutes(endTime);

    if (endMinutes <= startMinutes) {
      alert("End time must be after start time.");
      return;
    }

    if (repeat) {
      if (!until) {
        alert("Please select a repeat until date.");
        return;
      }
      if (daysOfWeek.length === 0) {
        alert("Please select at least one weekday.");
        return;
      }
      const untilDate = new Date(until);
      if (untilDate < selectedDate) {
        alert("Repeat until date must be after or equal to the meeting date.");
        return;
      }
    }

    let newMeetings = [];
    // Smart Meetings can create either one event or a recurring series.
    if (repeat) {
      const baseMeeting = {
        id: Date.now(),
        title,
        location: location.trim() ? location.trim() : "No location added",
        date,
        day: getDayLabelFromIso(date),
        startTime,
        endTime,
        startHour: startMinutes / 60,
        duration: (endMinutes - startMinutes) / 60,
        aiNotes,
        time: `${timeOptions.find((time) => time.value === startTime)?.label} - ${timeOptions.find((time) => time.value === endTime)?.label}`,
      };
      newMeetings = generateRecurringMeetings(baseMeeting, frequency, daysOfWeek, until);
    } else {
      const newMeeting = {
        id: Date.now(),
        title,
        location: location.trim() ? location.trim() : "No location added",
        date,
        day: getDayLabelFromIso(date),
        startTime,
        endTime,
        startHour: startMinutes / 60,
        duration: (endMinutes - startMinutes) / 60,
        aiNotes,
        time: `${timeOptions.find((time) => time.value === startTime)?.label} - ${timeOptions.find((time) => time.value === endTime)?.label}`,
      };
      newMeetings = [newMeeting];
    }

    setMeetings((prev) => [...prev, ...newMeetings]);
    setSuccessMessage(`${newMeetings.length > 1 ? "Meetings" : "Meeting"} scheduled successfully.`);
  };

  return (
    <section className="empty-card">
      <h2>Create a Smart Meeting</h2>
      <p>Schedule meetings, invite attendees, and enable AI meeting notes.</p>

      {successMessage && (
        <div className="success-popup">
          <div>
            <h3>Meeting scheduled ✅</h3>
            <p>{successMessage}</p>
          </div>

          <button onClick={() => setSuccessMessage("")}>Close</button>
        </div>
      )}

      <div className="form-box">
        <input
          placeholder="Meeting title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          placeholder="Meeting location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <div className="input-with-icon">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <span>📅</span>
        </div>

        <select
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        >
          <option value="">Select start time</option>
          {timeOptions.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
            </option>
          ))}
        </select>

        <select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
          <option value="">Select end time</option>
          {timeOptions.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
            </option>
          ))}
        </select>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={aiNotes}
            onChange={(e) => setAiNotes(e.target.checked)}
          />
          Enable AI Notes
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
          />
          Repeat this meeting
        </label>

        {repeat && (
          <>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="Does not repeat">Does not repeat</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
            </select>

            <label className="form-label">Repeat on</label>
            <div className="weekday-chip-row">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => {
                const selected = daysOfWeek.includes(day);
                return (
                  <label
                    key={day}
                    className={`weekday-chip ${selected ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDaysOfWeek([...daysOfWeek, day]);
                        } else {
                          setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
                        }
                      }}
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>

            <label className="form-label">Repeat until</label>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              placeholder="Repeat until"
            />
          </>
        )}

        <button className="primary-btn" onClick={handleCreate}>
          Create Meeting
        </button>
      </div>
    </section>
  );
}

function AINotesPage({ meetings }) {
  const aiMeetings = meetings.filter((meeting) => meeting.aiNotes);

  return (
    <section className="empty-card">
      <h2>AI Notes</h2>
      <p>Meeting notes will appear here after transcription and summarization.</p>

      {aiMeetings.length === 0 ? (
        <div className="empty-state-card">
          <h3>No AI note-enabled meetings yet</h3>
          <p>
            Turn on AI Notes when creating a Smart Meeting. Summaries, decisions,
            and action items will appear here after the meeting.
          </p>
        </div>
      ) : (
        aiMeetings.map((meeting) => (
          <div className="note-preview" key={meeting.id}>
            <h3>{meeting.title}</h3>
            <p>
              {meeting.day}, {meeting.time}
            </p>
            <p>
              Summary, key decisions, and action items will be generated by AI
              after the meeting.
            </p>
          </div>
        ))
      )}
    </section>
  );
}

function CalendarSyncPage() {
  return (
    <section className="empty-card">
      <h2>Calendar Integrations</h2>
      <p>Connect your calendars to keep PlanWISE AI updated.</p>

      <div className="empty-state-card integration-empty-state">
        <h3>No calendars connected</h3>
        <p>
          Connect Google Calendar or Outlook Calendar when you are ready to keep
          meetings, focus blocks, and availability in sync.
        </p>
      </div>

      <div className="integration-row">
        <button className="secondary-btn">Connect Google Calendar</button>
        <button className="secondary-btn">Connect Outlook Calendar</button>
      </div>
    </section>
  );
}

function SettingsPage({ themeMode, onThemeChange, onClearDemoData }) {
  // Theme options map directly to root app classes.
  const themeOptions = [
    {
      value: "light",
      title: "Light Mode",
      description: "Bright, clean planning workspace.",
    },
    {
      value: "dark",
      title: "Dark Mode",
      description: "Deeper contrast for low-light planning.",
    },
    {
      value: "system",
      title: "System Mode",
      description: "Match your device appearance.",
    },
  ];

  return (
    <section className="empty-card">
      <h2>Settings</h2>
      <p>Customize your planner, AI preferences, and calendar sync options.</p>

      <div className="settings-card settings-theme-card" aria-labelledby="appearance-heading">
        <div className="settings-card-copy">
          <span className="settings-kicker">Appearance</span>
          <h3 id="appearance-heading">Theme Settings</h3>
          <p>Choose the visual mode for PlanWISE AI. Changes apply immediately.</p>
        </div>

        <div className="theme-option-grid" role="radiogroup" aria-label="Theme mode">
          {themeOptions.map((option) => (
            <label
              key={option.value}
              className={`theme-option ${
                themeMode === option.value ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="themeMode"
                value={option.value}
                checked={themeMode === option.value}
                onChange={() => onThemeChange(option.value)}
              />
              <span className="theme-option-indicator" aria-hidden="true" />
              <span>{option.title}</span>
              <small>{option.description}</small>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div>
          <h3>Demo Data</h3>
          <p>
            Remove saved demo meetings and tasks from this browser. Your planner
            will return to an empty state.
          </p>
        </div>
        <button className="danger-btn" onClick={onClearDemoData}>
          Clear Demo Data
        </button>
      </div>
    </section>
  );
}

export default App;
