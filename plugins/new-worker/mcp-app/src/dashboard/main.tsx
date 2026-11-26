import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/ui/styles/base.css";
import "@/ui/styles/helpers.css";
import { DashboardApp } from "./DashboardApp.js";

const rootEl = document.getElementById("root");
if (rootEl) {
	createRoot(rootEl).render(
		<StrictMode>
			<DashboardApp />
		</StrictMode>,
	);
}
