import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceView } from "@/components/views/WorkspaceView.js";
import "@/shared/base.css";

const rootEl = document.getElementById("root");
if (rootEl) {
	createRoot(rootEl).render(
		<StrictMode>
			<WorkspaceView />
		</StrictMode>,
	);
}
