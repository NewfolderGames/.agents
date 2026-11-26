import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/ui/styles/base.css";
import "@/ui/styles/helpers.css";
import { WidgetApp } from "./WidgetApp.js";

const rootEl = document.getElementById("root");
if (rootEl) {
	createRoot(rootEl).render(
		<StrictMode>
			<WidgetApp />
		</StrictMode>,
	);
}
