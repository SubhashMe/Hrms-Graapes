import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3,
  CheckCircle2, LogIn, LogOut, CalendarCheck,
  AlertCircle, RefreshCw
} from 'lucide-react';
import './MyAttendance.css';

const API = '/api/attendance';

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  ));
}

function durationLabel(minutes) {
  if (!minutes) return '—';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusLabel(record) {
  if (!record) return 'No record';
  if (record.status) return String(record.status);
  if (record.checkOut) return 'Present';
  if (record.checkIn) return 'In progress';
  return 'Unknown';
}

function normalizeRecord(record) {
  return {
    ...record,
    date: record.date
      ? String(record.date).slice(0, 10)
      : record.checkIn
        ? formatDate(new Date(record.checkIn))
        : '',
    checkIn: record.checkIn ?? record.checkInAt ?? null,
    checkOut: record.checkOut ?? record.checkOutAt ?? null,
  };
}

export default function MyAttendance() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [records, setRecords] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('All');

  const today = formatDate(new Date());
  const monthName = month.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  async function loadAttendance() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API}?month=${month.getMonth() + 1}&year=${month.getFullYear()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Session expired. Please log in again.'
            : `Attendance could not be loaded (${response.status}).`
        );
      }

      const result = await response.json();
      const data = Array.isArray(result)
        ? result
        : result.records ?? result.data ?? [];

      const normalized = data.map(normalizeRecord);
      setRecords(normalized);

      const todayResponse = normalized.find((item) => item.date === today);
      setTodayRecord(todayResponse ?? null);
    } catch (err) {
      setRecords([]);
      setTodayRecord(null);
      setError(err.message || 'Unable to load attendance.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttendance();
    // Reload when the displayed month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const summary = useMemo(() => {
    const currentMonthRecords = records.filter(
      (record) => record.date?.startsWith(
        `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      )
    );

    const present = currentMonthRecords.filter((record) =>
      ['present', 'late', 'in progress', 'checked in'].includes(
        statusLabel(record).toLowerCase()
      )
    ).length;

    const absent = currentMonthRecords.filter(
      (record) => statusLabel(record).toLowerCase() === 'absent'
    ).length;

    const late = currentMonthRecords.filter(
      (record) => statusLabel(record).toLowerCase() === 'late'
    ).length;

    const minutes = currentMonthRecords.reduce((total, record) => {
      const recordedMinutes = Number(record.workingMinutes);
      return total + (
        Number.isFinite(recordedMinutes) && recordedMinutes > 0
          ? recordedMinutes
          : minutesBetween(record.checkIn, record.checkOut)
      );
    }, 0);

    return { present, absent, late, minutes };
  }, [records, month]);

  async function punch(action) {
    setActionLoading(true);
    setError('');

    try {
      const response = await fetch(`${API}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Unable to ${action.replace('-', ' ')}.`);
      }

      await loadAttendance();
    } catch (err) {
      setError(
        `${err.message} Check that the backend supports POST ${API}/${action}.`
      );
    } finally {
      setActionLoading(false);
    }
  }

  const firstWeekday = new Date(
    month.getFullYear(), month.getMonth(), 1
  ).getDay();

  const daysInMonth = new Date(
    month.getFullYear(), month.getMonth() + 1, 0
  ).getDate();

  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const recordByDate = Object.fromEntries(
    records.map((record) => [record.date, record])
  );

  const filteredRecords = records.filter((record) => {
    if (filter === 'All') return true;
    return statusLabel(record).toLowerCase() === filter.toLowerCase();
  });

  const checkedIn = Boolean(todayRecord?.checkIn);
  const checkedOut = Boolean(todayRecord?.checkOut);
  const canCheckIn = !checkedIn;
  const canCheckOut = checkedIn && !checkedOut;

  function moveMonth(offset) {
    setMonth((current) => new Date(
      current.getFullYear(), current.getMonth() + offset, 1
    ));
  }

  return (
    <main className="my-attendance">
      <header className="attendance-heading">
        <div>
          <h1><CalendarCheck size={25} /> My Attendance</h1>
          <p>Track your attendance and working hours</p>
        </div>

        <div className="month-picker">
          <CalendarDays size={18} />
          <span>{monthName}</span>
          <button aria-label="Previous month" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Next month" onClick={() => moveMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {error && (
        <div className="attendance-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button onClick={loadAttendance}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      <section className="attendance-summary">
        <article className="summary-card present">
          <span className="summary-icon"><CheckCircle2 /></span>
          <div>
            <p>Present Days</p>
            <strong>{loading ? '—' : summary.present}</strong>
            <small>From loaded records</small>
          </div>
        </article>

        <article className="summary-card absent">
          <span className="summary-icon"><AlertCircle /></span>
          <div>
            <p>Absent Days</p>
            <strong>{loading ? '—' : summary.absent}</strong>
            <small>From loaded records</small>
          </div>
        </article>

        <article className="summary-card late">
          <span className="summary-icon"><Clock3 /></span>
          <div>
            <p>Late Arrivals</p>
            <strong>{loading ? '—' : summary.late}</strong>
            <small>From loaded records</small>
          </div>
        </article>

        <article className="summary-card hours">
          <span className="summary-icon"><Clock3 /></span>
          <div>
            <p>Total Working Hours</p>
            <strong>{loading ? '—' : durationLabel(summary.minutes)}</strong>
            <small>From loaded records</small>
          </div>
        </article>
      </section>

      <section className="today-attendance">
        <div className="today-title">
          <div>
            <span className={`live-dot ${checkedIn && !checkedOut ? 'active' : ''}`} />
            <div>
              <h2>Today's Status</h2>
              <strong className={checkedOut ? 'status-done' : checkedIn ? 'status-live' : ''}>
                {checkedOut
                  ? 'Checked Out'
                  : checkedIn
                    ? 'Checked In'
                    : 'Not Checked In'}
              </strong>
            </div>
          </div>
          <span>{new Date().toLocaleDateString('en-IN', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
          })}</span>
        </div>

        <div className="today-details">
          <div>
            <Clock3 />
            <span>Check In</span>
            <strong>{formatTime(todayRecord?.checkIn)}</strong>
          </div>
          <div>
            <Clock3 />
            <span>Check Out</span>
            <strong>{formatTime(todayRecord?.checkOut)}</strong>
          </div>
          <div>
            <Clock3 />
            <span>Working Hours</span>
            <strong>{durationLabel(
              Number(todayRecord?.workingMinutes) ||
              minutesBetween(todayRecord?.checkIn, todayRecord?.checkOut)
            )}</strong>
          </div>
        </div>

        <div className="attendance-actions">
          <button
            className="punch-button check-in"
            disabled={!canCheckIn || actionLoading}
            onClick={() => punch('check-in')}
          >
            <LogIn size={17} />
            {actionLoading ? 'Please wait…' : 'Check In'}
          </button>

          <button
            className="punch-button check-out"
            disabled={!canCheckOut || actionLoading}
            onClick={() => punch('check-out')}
          >
            <LogOut size={17} /> Check Out
          </button>

          <small>Check-in/out requires a working, authenticated backend.</small>
        </div>
      </section>

      <section className="attendance-lower">
        <div className="attendance-calendar panel">
          <h2>{monthName}</h2>

          <div className="calendar-grid calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarCells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;

              const dateKey = formatDate(new Date(
                month.getFullYear(), month.getMonth(), day
              ));
              const record = recordByDate[dateKey];
              const status = statusLabel(record).toLowerCase();
              const isToday = dateKey === today;

              return (
                <div
                  className={`calendar-day ${isToday ? 'is-today' : ''}`}
                  key={dateKey}
                  title={`${dateKey}: ${record ? statusLabel(record) : 'No record'}`}
                >
                  <span>{day}</span>
                  <i className={
                    status === 'present' || status === 'checked in' || status === 'in progress'
                      ? 'dot-present'
                      : status === 'absent'
                        ? 'dot-absent'
                        : status === 'late'
                          ? 'dot-late'
                          : status === 'holiday'
                            ? 'dot-holiday'
                            : status === 'leave'
                              ? 'dot-leave'
                              : ''
                  } />
                </div>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="dot-present" /> Present</span>
            <span><i className="dot-absent" /> Absent</span>
            <span><i className="dot-late" /> Late</span>
            <span><i className="dot-holiday" /> Holiday</span>
            <span><i className="dot-leave" /> Leave</span>
          </div>
        </div>

        <div className="attendance-history panel">
          <div className="history-heading">
            <h2>Attendance History</h2>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              {['All', 'Present', 'Absent', 'Late', 'Holiday', 'Leave'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="5" className="attendance-empty">
                      No attendance records found for this month.
                    </td>
                  </tr>
                )}

                {filteredRecords.map((record) => (
                  <tr key={record.id ?? record.date}>
                    <td>{record.date || '—'}</td>
                    <td>{formatTime(record.checkIn)}</td>
                    <td>{formatTime(record.checkOut)}</td>
                    <td>{durationLabel(
                      Number(record.workingMinutes) ||
                      minutesBetween(record.checkIn, record.checkOut)
                    )}</td>
                    <td>
                      <span className={`status-badge ${statusLabel(record).toLowerCase().replace(/\s+/g, '-')}`}>
                        {statusLabel(record)}
                      </span>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td colSpan="5" className="attendance-empty">Loading attendance…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button className="refresh-attendance" onClick={loadAttendance}>
            <RefreshCw size={15} /> Refresh records
          </button>
        </div>
      </section>
    </main>
  );
}