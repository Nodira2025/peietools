import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Agenda from "../../src/pages/Agenda";
import AgendaNotifications from "../../src/components/AgendaNotifications";
import { useAuthStore } from "../../src/store/auth";
import "../../src/index.css";
useAuthStore.setState({
  loading: false,
  profile: {
    id: "admin",
    full_name: "Administración",
    username: "test",
    role: "admin",
    whatsapp: null,
    obra_id: null,
    active: true,
  },
});
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <div className="p-3">
      <Routes>
        <Route path="/avisos" element={<AgendaNotifications />} />
        <Route path="*" element={<Agenda />} />
      </Routes>
    </div>
  </BrowserRouter>,
);
