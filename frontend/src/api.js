// Base API Client for ExamSphere
export const BACKEND_URL = 'http://localhost:5000';
const API_BASE = `${BACKEND_URL}/api`;

export const getFullPhotoUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://') || photoPath.startsWith('data:')) {
    return photoPath;
  }
  return `${BACKEND_URL}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
};

export const api = {
  // Authentication & User Session (uses sessionStorage so opening website requires login)
  getToken() {
    return sessionStorage.getItem('examsphere_token');
  },

  setToken(token) {
    sessionStorage.setItem('examsphere_token', token);
    try {
      localStorage.removeItem('examsphere_token');
    } catch {}
  },

  removeToken() {
    sessionStorage.removeItem('examsphere_token');
    sessionStorage.removeItem('examsphere_user');
    try {
      localStorage.removeItem('examsphere_token');
      localStorage.removeItem('examsphere_user');
    } catch {}
  },

  getUser() {
    try {
      return JSON.parse(sessionStorage.getItem('examsphere_user'));
    } catch {
      return null;
    }
  },

  setUser(user) {
    sessionStorage.setItem('examsphere_user', JSON.stringify(user));
    try {
      localStorage.removeItem('examsphere_user');
    } catch {}
  },

  // Base HTTP Request
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...(options.headers || {}) };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const isFormData =
      typeof FormData !== 'undefined' &&
      options.body instanceof FormData;

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.message || `Request failed with status ${res.status}`
      );
    }

    return data;
  },

  // Module 1: Authentication
  login(email, password, role) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
  },

  getMe() {
    return this.request('/auth/me');
  },

  // Module 2: Master Data
  getEntities(type) {
    return this.request(`/master-data/${type}`);
  },

  deleteEntity(type, id) {
    return this.request(`/master-data/${type}/${id}`, {
      method: 'DELETE',
    });
  },

  clearEntityType(type) {
    return this.request(`/master-data/clear/${type}`, {
      method: 'DELETE',
    });
  },

  uploadCSV(type, file) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request(`/master-data/upload-csv/${type}`, {
      method: 'POST',
      body: formData,
    });
  },

  resetDatabase() {
    return this.request('/master-data/reset-database', {
      method: 'POST',
    });
  },

  // Admin
  getSystemSummary() {
    return this.request('/admin/system-summary');
  },

  // Module 3: Exam Scheduling & Timetable
  getExams(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.examType) searchParams.append('examType', params.examType);
    if (params.status) searchParams.append('status', params.status);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.request(`/scheduling/exams${qs ? `?${qs}` : ''}`);
  },

  getExam(id) {
    return this.request(`/scheduling/exams/${id}`);
  },

  createExam(data) {
    return this.request('/scheduling/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateExam(id, data) {
    return this.request(`/scheduling/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteExam(id) {
    return this.request(`/scheduling/exams/${id}`, {
      method: 'DELETE',
    });
  },

  detectConflicts() {
    return this.request('/scheduling/conflicts');
  },

  validateExamSlot(data) {
    return this.request('/scheduling/validate-slot', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  generateTimetable(data) {
    return this.request('/scheduling/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getTimetableMatrix(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.examType) searchParams.append('examType', params.examType);
    const qs = searchParams.toString();
    return this.request(`/scheduling/matrix${qs ? `?${qs}` : ''}`);
  },

  autoResolveConflicts(data = {}) {
    return this.request('/scheduling/auto-resolve', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  suggestOptimalSlot(data) {
    return this.request('/scheduling/suggest-slot', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  seedDemoSchedule() {
    return this.request('/scheduling/seed-demo', {
      method: 'POST',
    });
  },

  clearAllExams() {
    return this.request('/scheduling/clear-all', {
      method: 'DELETE',
    });
  },

  getDatesSpan() {
    return this.request('/scheduling/dates-span');
  },

  saveDatesSpan(data) {
    return this.request('/scheduling/dates-span', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },


  // Module 4A: Anti-Cheating Seating Allocation API
  allocateSeating(data) {
    return this.request('/seating/allocate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSeatingForExam(examId) {
    return this.request(`/seating/exam/${examId}`);
  },

  getRoomSeatingGrid(roomId, examId = null) {
    const queryStr = examId
      ? `?examId=${encodeURIComponent(examId)}`
      : '';

    return this.request(`/seating/room/${roomId}/grid${queryStr}`);
  },

  getRoomsOverview(examId = null) {
    const queryStr = examId
      ? `?examId=${encodeURIComponent(examId)}`
      : '';

    return this.request(`/seating/rooms-overview${queryStr}`);
  },

  clearSeatingAllocations(examId) {
    return this.request(`/seating/exam/${examId}`, {
      method: 'DELETE',
    });
  },

  // Module 4B: Room & Seating Allocation Engine API
  getAllocationExams() {
    return this.request('/allocations/exams');
  },

  allocateSeats(payload) {
    return this.request('/allocations/seating', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getSeatingByExam(examId) {
    return this.request(`/allocations/exam/${examId}`);
  },

  getRoomLayout(roomId, examId = null, strict = false) {
    const params = [];

    if (examId) {
      params.push(`examId=${encodeURIComponent(examId)}`);
    }

    if (strict) {
      params.push('strict=true');
    }

    const queryStr = params.length
      ? `?${params.join('&')}`
      : '';

    return this.request(`/allocations/room/${roomId}${queryStr}`);
  },

  clearAllocations(examId) {
    return this.request(`/allocations/exam/${examId}`, {
      method: 'DELETE',
    });
  },

  seedDemoExams() {
    return this.request('/allocations/seed-demo-exams', {
      method: 'POST',
    });
  },

  getEnrolledStudents(examId) {
    return this.request(`/allocations/enrolled-students/${examId}`);
  },

  saveManualSeating(payload) {
    return this.request('/allocations/manual-save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  assignManualSeat(payload) {
    return this.request('/allocations/manual-seat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  unassignManualSeat(payload) {
    return this.request('/allocations/manual-seat', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  },

  // Module 5: Faculty Duty & Workload Management
  getDutyRoster() {
    return this.request('/duty/roster');
  },

  getWorkloadStats() {
    return this.request('/duty/workload-stats');
  },

  autoAllocateDuties(data = {}) {
    return this.request('/duty/auto-allocate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  checkFacultyAvailability(params) {
    const query = new URLSearchParams(params).toString();

    return this.request(`/duty/availability?${query}`);
  },

  assignDuty(data) {
    return this.request('/duty/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  assignSubstitute(dutyId, substituteFacultyId) {
    return this.request(`/duty/${dutyId}/substitute`, {
      method: 'PUT',
      body: JSON.stringify({ substituteFacultyId }),
    });
  },

  removeDuty(dutyId) {
    return this.request(`/duty/${dutyId}`, {
      method: 'DELETE',
    });
  },

  resetDuties() {
    return this.request('/duty/reset-all', {
      method: 'POST',
    });
  },

  // Module 8: Exam-Day Incident Management (UFM)
  getIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();

    return this.request(
      `/incidents/ufm${query ? `?${query}` : ''}`
    );
  },

  getIncident(id) {
    return this.request(`/incidents/ufm/${id}`);
  },

  submitIncident(data) {
    return this.request('/incidents/ufm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateIncidentAction(id, actionData) {
    return this.request(`/incidents/ufm/${id}/action`, {
      method: 'PUT',
      body: JSON.stringify(actionData),
    });
  },

  getIncidentStats() {
    return this.request('/incidents/stats');
  },

  deleteIncident(id) {
    return this.request(`/incidents/ufm/${id}`, {
      method: 'DELETE',
    });
  },

  // Module 7: Invigilator Portal & Attendance
  getInvigilatorDuties(facultyId = null) {
    const query = facultyId ? `?faculty_id=${encodeURIComponent(facultyId)}` : '';
    return this.request(`/invigilator/duties${query}`);
  },

  confirmDuty(dutyId, status = 'CONFIRMED') {
    return this.request(`/invigilator/duties/${dutyId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  getDutyStudents(dutyId, roomId = null) {
    const query = roomId ? `?room_id=${encodeURIComponent(roomId)}` : '';
    return this.request(`/invigilator/duties/${dutyId}/students${query}`);
  },

  markAttendance(payload) {
    return this.request('/invigilator/attendance/mark', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkMarkAttendance(payload) {
    return this.request('/invigilator/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyFace(payload) {
    return this.request('/invigilator/attendance/verify-face', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  resetDutyAttendance(dutyId) {
    return this.request(`/invigilator/attendance/${dutyId}/reset`, {
      method: 'POST',
    });
  },

  seedDuties() {
    return this.request('/invigilator/seed-duties', {
      method: 'POST',
    });
  },

  getAttendanceOverview(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.examId) searchParams.append('examId', params.examId);
    if (params.roomId) searchParams.append('roomId', params.roomId);
    if (params.status) searchParams.append('status', params.status);
    if (params.method) searchParams.append('method', params.method);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.request(`/invigilator/attendance/overview${qs ? `?${qs}` : ''}`);
  },

  // Module 6: Faculty Portal & Doubt Resolution API
  getFacultySchedule(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.facultyId) searchParams.append('facultyId', params.facultyId);
    if (params.email) searchParams.append('email', params.email);
    if (params.department) searchParams.append('department', params.department);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.examType) searchParams.append('examType', params.examType);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.request(`/faculty-portal/schedule${qs ? `?${qs}` : ''}`);
  },

  getFacultyDuties(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.facultyId) searchParams.append('facultyId', params.facultyId);
    if (params.email) searchParams.append('email', params.email);
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.request(`/faculty-portal/duties${qs ? `?${qs}` : ''}`);
  },

  updateFacultyDutyStatus(dutyId, data) {
    return this.request(`/faculty-portal/duties/${dutyId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getDoubtRequests(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.facultyId) searchParams.append('facultyId', params.facultyId);
    if (params.email) searchParams.append('email', params.email);
    if (params.examId) searchParams.append('examId', params.examId);
    if (params.roomId) searchParams.append('roomId', params.roomId);
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.request(`/faculty-portal/doubts${qs ? `?${qs}` : ''}`);
  },

  createDoubtRequest(data) {
    return this.request('/faculty-portal/doubts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  resolveDoubtRequest(doubtId, data) {
    return this.request(`/faculty-portal/doubts/${doubtId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getFacultyMetrics(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.facultyId) searchParams.append('facultyId', params.facultyId);
    if (params.email) searchParams.append('email', params.email);
    const qs = searchParams.toString();
    return this.request(`/faculty-portal/metrics${qs ? `?${qs}` : ''}`);
  },

  getFacultyNotifications(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.email) searchParams.append('email', params.email);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.request(`/faculty-portal/notifications${qs ? `?${qs}` : ''}`);
  },

  sendFacultyEmail(data) {
    return this.request('/faculty-portal/send-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Module 10: Analytics & Reports
  getRoomUtilization() {
    return this.request('/analytics/room-utilization');
  },

  getAttendanceStats() {
    return this.request('/analytics/attendance-stats');
  },

  getFacultyWorkload() {
    return this.request('/analytics/faculty-workload');
  },

  getUFMSummary() {
    return this.request('/analytics/ufm-summary');
  },

  // Module 9: Notification & Alert System
  sendEmergencyBroadcast(data) {
    return this.request('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getNotificationLogs(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.recipient) searchParams.append('recipient', params.recipient);
    if (params.type) searchParams.append('type', params.type);
    if (params.status) searchParams.append('status', params.status);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);
    const qs = searchParams.toString();
    return this.request(`/notifications/logs${qs ? `?${qs}` : ''}`);
  },

  getNotificationStats() {
    return this.request('/notifications/stats');
  },

  sendStudentNotification(data) {
    return this.request('/notifications/student', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  sendFacultyDutyNotification(data) {
    return this.request('/notifications/faculty', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
