import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './layout/Layout';
import LeadsList from './components/leads/LeadsList';
import LeadDetail from './components/leads/LeadDetail';
import TodosList from './components/todos/TodosList';
import Activities from './components/todos/Activities';
import Calendar from './components/calendar/Calendar';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <ProtectedRoute>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/leads" replace />} />
              <Route path="leads" element={<LeadsList />} />
              <Route path="pipelines" element={<LeadsList isInPipeline={true} />} />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="tasks" element={<TodosList />} />
              <Route
                path="follow-ups"
                element={<TodosList defaultType="Follow Up" title="Follow Ups" />}
              />
              <Route
                path="meetings"
                element={<TodosList defaultType="Meeting" title="My Meetings" />}
              />
              <Route
                path="find-match"
                element={<TodosList defaultType="Find Match" title="Find Match" />}
              />
              <Route
                path="to-schedule-visit"
                element={
                  <TodosList
                    defaultType="Schedule Site Visit"
                    title="Site Visits"
                  />
                }
              />
              <Route path="activities" element={<Activities />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="*" element={<Navigate to="/leads" replace />} />
            </Route>
          </Routes>
        </ProtectedRoute>

        <ToastContainer
          position="top-right"
          autoClose={2000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss={false}
          draggable
          pauseOnHover={false}
          theme="light"
        />
      </AppProvider>
    </AuthProvider>
  );
};

export default App;