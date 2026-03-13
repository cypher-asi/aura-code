import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EventProvider } from "./context/EventContext";
import { AppShell } from "./components/AppShell";
import { HomeView } from "./views/HomeView";
import { NewProjectView } from "./views/NewProjectView";
import { ProjectLayout } from "./views/ProjectLayout";
import { AgentChat } from "./components/AgentChat";
import { SettingsView } from "./views/SettingsView";
import { ExecutionView } from "./views/ExecutionView";

export default function App() {
  return (
    <BrowserRouter>
      <EventProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomeView />} />
            <Route path="new-project" element={<NewProjectView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<AgentChat />} />
              <Route path="execution" element={<ExecutionView />} />
            </Route>
          </Route>
        </Routes>
      </EventProvider>
    </BrowserRouter>
  );
}
