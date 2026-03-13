import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@cypher-asi/zui";
import "@cypher-asi/zui/styles";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" defaultAccent="purple">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
