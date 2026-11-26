import { type RefObject, useEffect } from "react";

/**
 * Sync native `:user-invalid` validation state to `aria-invalid`, `aria-describedby`,
 * and a single polite live region, starting every field at `aria-invalid="false"`.
 *
 * @param formRef - Form element whose interactive controls receive validation listeners.
 * @param enabled - Toggle listener registration (set false while enclosing dialog is closed).
 */
export function useFormAriaSync(
	formRef: RefObject<HTMLFormElement | null>,
	enabled = true,
): void {
	useEffect(() => {
		const form = formRef.current;
		if (!enabled || !form) {
			return;
		}

		const announcer = document.createElement("div");
		announcer.setAttribute("aria-live", "polite");
		announcer.classList.add("visually-hidden");
		const announcerHost = form.closest("dialog")
			?? form.ownerDocument.querySelector("body")
			?? form.ownerDocument.documentElement;
		announcerHost.append(announcer);

		let announceTimer: ReturnType<typeof setTimeout> | undefined;
		let announcedField: Element | undefined;
		const flagged = new WeakSet<Element>();
		const announced = new WeakSet<Element>();

		const linkError = (el: HTMLElement, shown: boolean) => {
			const errorId = el.dataset.error;
			if (!errorId) {
				return;
			}
			const ids = (el.getAttribute("aria-describedby") || "")
				.split(/\s+/)
				.filter(id => id && id !== errorId);
			if (shown) {
				ids.push(errorId);
			}
			if (ids.length > 0) {
				el.setAttribute("aria-describedby", ids.join(" "));
			}
			else {
				el.removeAttribute("aria-describedby");
			}
		};

		const announceError = (el: HTMLElement) => {
			const errorId = el.dataset.error;
			if (!errorId) {
				return;
			}
			const errorEl = document.getElementById(errorId);
			if (!errorEl) {
				return;
			}
			const text = errorEl.textContent?.replace(/\s+/g, " ").trim() ?? "";
			if (!text) {
				return;
			}
			clearTimeout(announceTimer);
			announcer.textContent = "";
			announcedField = el;
			announceTimer = setTimeout(() => {
				announcer.textContent = text;
			}, 500);
		};

		const syncAria = (target: EventTarget | null, announce = false) => {
			if (!(target instanceof HTMLElement)) {
				return;
			}
			if (!target.matches("input, select, textarea")) {
				return;
			}
			const invalid = target.matches(":user-invalid");
			if (invalid) {
				if (announce && !announced.has(target)) {
					announceError(target);
					announced.add(target);
				}
				target.setAttribute("aria-invalid", "true");
				linkError(target, true);
				flagged.add(target);
				return;
			}
			if (flagged.has(target) || target.getAttribute("aria-invalid") !== "true") {
				target.setAttribute("aria-invalid", "false");
				linkError(target, false);
				flagged.delete(target);
				announced.delete(target);
				if (announcedField === target) {
					clearTimeout(announceTimer);
					announcer.textContent = "";
				}
			}
		};

		form.querySelectorAll("input, select, textarea").forEach(el => syncAria(el));

		const onBlur = (e: FocusEvent) => syncAria(e.target, true);
		const onInput = (e: Event) => {
			if (e.target instanceof HTMLElement && e.target.hasAttribute("aria-invalid")) {
				syncAria(e.target);
			}
		};
		const onChange = (e: Event) => syncAria(e.target, true);
		const onInvalid = (e: Event) => {
			if (e.target instanceof HTMLElement) {
				announced.add(e.target);
				syncAria(e.target);
			}
		};
		const onReset = () => {
			setTimeout(() => {
				form.querySelectorAll("input, select, textarea").forEach(el => syncAria(el));
			});
		};

		form.addEventListener("blur", onBlur, true);
		form.addEventListener("input", onInput);
		form.addEventListener("change", onChange, true);
		form.addEventListener("invalid", onInvalid, true);
		form.addEventListener("reset", onReset, true);

		return () => {
			clearTimeout(announceTimer);
			form.removeEventListener("blur", onBlur, true);
			form.removeEventListener("input", onInput);
			form.removeEventListener("change", onChange, true);
			form.removeEventListener("invalid", onInvalid, true);
			form.removeEventListener("reset", onReset, true);
			announcer.remove();
		};
	}, [formRef, enabled]);
}
