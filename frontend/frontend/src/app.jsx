import { useEffect, useMemo, useState } from "react";
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
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Critical");
  const [newTaskStatus, setNewTaskStatus] = useState("Active");
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
    localStorage.setItem("planwise-meetings", JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    localStorage.setItem("planwise-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const updateTask = (taskId, updates) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  const openTaskModal = () => {
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskPriority("Critical");
    setNewTaskStatus("Active");
    setNewTaskNotes("");
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title || "");
    setNewTaskDate(task.date || "");
    setNewTaskPriority(task.priority || "Critical");
    setNewTaskStatus(task.status || (task.completed ? "Closed" : "Active"));
    setNewTaskNotes(task.notes || "");
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskPriority("Critical");
    setNewTaskStatus("Active");
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
      completed: newTaskStatus === "Closed",
    };

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

  const openSmartMeetingModal = () => setShowSmartMeetingModal(true);
  const closeSmartMeetingModal = () => {
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
    <div className="app">
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
        </header>

        <div className="page-content">
          {activePage === "Planner" && (
            <PlannerPage
              meetings={meetings}
              setMeetings={setMeetings}
              selectedMeeting={selectedMeeting}
              setSelectedMeeting={setSelectedMeeting}
              onCreateMeetingAt={openSmartMeetingAt}
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
          {activePage === "Settings" && <SettingsPage />}
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
                  <option value="Active">Active</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>

                <textarea
                  placeholder="Notes"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                />

                <div className="modal-actions">
                  <button className="secondary-btn" onClick={closeTaskModal}>
                    Cancel
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
  selectedMeeting,
  setSelectedMeeting,
  onCreateMeetingAt,
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

  const todayIso = getDateKey(new Date());

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
    const dayItems = meetings
      .filter(
        (meeting) =>
          meeting.date === dayIso ||
          (!meeting.date && meeting.day === dayLabel)
      )
      .map((meeting) => {
        const start = meeting.startHour != null
          ? meeting.startHour * 60
          : getMinutes(meeting.startTime);
        const duration = meeting.duration != null
          ? meeting.duration
          : (getMinutes(meeting.endTime) - start) / 60;
        const end = start + duration * 60;
        return {
          meeting,
          start,
          end,
          duration,
          column: 0,
          maxOverlap: 1,
        };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const columns = [];
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

  const upcomingMeetings = meetings
    .filter((meeting) => {
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

      setMeetings((prev) =>
        prev.map((meeting) => {
          if (meeting.id !== dragState.meetingId) return meeting;
          return {
            ...meeting,
            duration: updatedDuration / 60,
            endTime: endOption.value,
            time: updatedTimeLabel,
          };
        })
      );
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
  }, [dragState, setMeetings, timeOptions]);

  const openEdit = () => {
    if (!selectedMeeting) return;

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

    setMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === selectedMeeting.id ? updatedMeeting : meeting
      )
    );

    setSelectedMeeting(updatedMeeting);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setMeetings((prev) =>
      prev.filter((meeting) => meeting.id !== selectedMeeting.id)
    );
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

      <div className="planner-main-grid">
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
            {weekDays.map((day) => (
              <div
                className={`day-column ${day.isToday ? "today-column" : ""}`}
                key={day.iso}
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

                  return (
                    <div
                      key={item.meeting.id}
                      className="event meeting clickable-event"
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
                      {item.meeting.title}
                      <br />
                      {item.meeting.time}
                      {item.meeting.aiNotes && (
                        <>
                          <br />
                          AI Notes On
                        </>
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
            ))}
          </div>
        </div>

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
                <h3>Edit Meeting</h3>

                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Meeting title"
                />

                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Meeting location"
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

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={editAiNotes}
                    onChange={(e) => setEditAiNotes(e.target.checked)}
                  />
                  Enable AI Notes
                </label>
              </>
            ) : (
              <>
                <h3>{selectedMeeting.title}</h3>
                <p>
                  <strong>Day:</strong>{" "}
                  {selectedMeeting.day || getDayLabelFromIso(selectedMeeting.date)}
                </p>
                <p>
                  <strong>Time:</strong> {selectedMeeting.time}
                </p>
                <p>
                  <strong>Location:</strong>{" "}
                  {selectedMeeting.location || "No location added"}
                </p>
                <p>
                  <strong>AI Notes:</strong>{" "}
                  {selectedMeeting.aiNotes ? "Enabled" : "Disabled"}
                </p>
                {selectedMeeting.recurrence && (
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
  const columns = ["Active", "In Progress", "Closed"];

  const groupedTasks = columns.reduce((acc, column) => {
    acc[column] = [];
    return acc;
  }, {});

  tasks.forEach((task) => {
    const status = columns.includes(task.status)
      ? task.status
      : task.completed
      ? "Closed"
      : "Active";
    groupedTasks[status].push(task);
  });

  const handleDrop = (event, column) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const id = Number(taskId);
    if (column === "Closed") {
      onUpdateTask(id, { completed: true, status: "Closed" });
    } else {
      onUpdateTask(id, { completed: false, status: column });
    }
  };

  const handleDragStart = (event, taskId) => {
    event.dataTransfer.setData("text/plain", String(taskId));
    event.dataTransfer.effectAllowed = "move";
  };

  const handlePriorityChange = (taskId, priority) => {
    onUpdateTask(taskId, { priority });
  };

  return (
    <section className="tasks-board">
      {columns.map((column) => (
        <div
          key={column}
          className="tasks-column"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, column)}
        >
          <div className="tasks-column-header">
            <h3>{column}</h3>
            {column === "Closed" && (
              <span className="tasks-column-count">
                {groupedTasks.Closed.length}
              </span>
            )}
          </div>
          {groupedTasks[column].length === 0 ? (
            <p className="empty-text">No tasks</p>
          ) : (
            groupedTasks[column].map((task) => (
              <div
                key={task.id}
                className={`task-card task-card-drag ${task.completed ? "task-completed" : ""}`}
                draggable
                onDragStart={(event) => handleDragStart(event, task.id)}
              >
                <div className="task-card-top">
                  <div className="task-card-title-wrap">
                    <strong className={task.completed ? "task-title-closed" : ""}>
                      {task.title}
                    </strong>
                    {task.completed && (
                      <span className="task-status-pill">Closed</span>
                    )}
                  </div>
                </div>
                <div className="task-card-priority-row">
                  <label>
                    Priority
                    <select
                      value={task.priority}
                      onChange={(e) => handlePriorityChange(task.id, e.target.value)}
                    >
                      {TASK_PRIORITIES.map((priorityOption) => (
                        <option key={priorityOption} value={priorityOption}>
                          {priorityOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="task-card-meta">Due {formatDueDate(task.date)}</p>
                {task.notes && <p className="task-card-note">{task.notes}</p>}
                <div className="task-card-bottom">
                  <span className="task-priority-chip">{task.priority}</span>
                  <div className="task-card-actions">
                    <button
                      className="secondary-btn task-edit-btn"
                      onClick={() => onEditTask(task)}
                    >
                      Edit
                    </button>
                    <button
                      className="secondary-btn task-delete-btn"
                      onClick={() => onDeleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
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
        <div className="note-preview">
          <h3>No AI note-enabled meetings yet</h3>
          <p>Create a Smart Meeting and turn on AI Notes to see it here.</p>
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

      <div className="integration-row">
        <button className="secondary-btn">Connect Google Calendar</button>
        <button className="secondary-btn">Connect Outlook Calendar</button>
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="empty-card">
      <h2>Settings</h2>
      <p>Customize your planner, AI preferences, and calendar sync options.</p>
    </section>
  );
}

export default App;