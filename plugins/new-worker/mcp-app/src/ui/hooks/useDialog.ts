import { type RefObject, useEffect } from "react";

/** Input options for {@link useDialog}. */
export interface UseDialogOptions {
	dialogRef: RefObject<HTMLDialogElement | null>;
	open: boolean;
	allowLightDismiss?: boolean;
	onClose: (returnValue: string) => void;
}

/**
 * Manage native `<dialog>` `showModal()`, `returnValue` reset on close, and the
 * pointer-bounding fallback when `HTMLDialogElement.prototype.closedBy` is missing.
 */
export function useDialog({
	dialogRef,
	open,
	allowLightDismiss = true,
	onClose,
}: UseDialogOptions): void {
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		}
		else if (!open && dialog.open) {
			dialog.close();
		}
	}, [dialogRef, open]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}

		const handleClose = () => {
			const value = dialog.returnValue;
			dialog.returnValue = "";
			onClose(value);
		};
		dialog.addEventListener("close", handleClose);

		let cleanupFallback: (() => void) | undefined;
		if (allowLightDismiss && !("closedBy" in HTMLDialogElement.prototype)) {
			const isOutside = (e: PointerEvent) => {
				const rect = dialog.getBoundingClientRect();
				return (
					e.clientX < rect.left
					|| e.clientX > rect.right
					|| e.clientY < rect.top
					|| e.clientY > rect.bottom
				);
			};
			let pressedOutside = false;
			const onPointerDown = (e: PointerEvent) => {
				pressedOutside = isOutside(e);
			};
			const onPointerUp = (e: PointerEvent) => {
				if (pressedOutside && isOutside(e)) {
					dialog.close("");
				}
				pressedOutside = false;
			};
			dialog.addEventListener("pointerdown", onPointerDown);
			dialog.addEventListener("pointerup", onPointerUp);
			cleanupFallback = () => {
				dialog.removeEventListener("pointerdown", onPointerDown);
				dialog.removeEventListener("pointerup", onPointerUp);
			};
		}

		return () => {
			dialog.removeEventListener("close", handleClose);
			cleanupFallback?.();
		};
	}, [dialogRef, allowLightDismiss, onClose]);
}
