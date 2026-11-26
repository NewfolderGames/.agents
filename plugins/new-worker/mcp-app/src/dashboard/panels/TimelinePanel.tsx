import { useState } from "react";
import type { DashboardScope, SessionSummary, TimelineActor, TimelineEntityType, TimelineEvent, TimelineLink } from "@/shared/contracts.js";
import { formatShortTimestamp } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FilterPills } from "@/ui/primitives/FilterPills.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./TimelinePanel.module.css";

export interface TimelinePanelProps {
	scope: DashboardScope;
	events: TimelineEvent[];
	sessions: SessionSummary[];
	onOpenNoteDialog: () => void;
	onNavigateLink: (link: TimelineLink) => void;
}

type ActorFilter = "all" | TimelineActor;
type EntityFilter = "all" | TimelineEntityType;

/** Dashboard panel rendering chronological polymorphic timeline events with actor/entity filters. */
export function TimelinePanel({
	scope,
	events,
	sessions,
	onOpenNoteDialog,
	onNavigateLink,
}: TimelinePanelProps) {
	const [actorFilter, setActorFilter] = useState<ActorFilter>("all");
	const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");

	const sessionNames = new Map(sessions.map(s => [s.sessionId, s.title ?? s.sessionId]));

	const presentEntityTypes = Array.from(
		new Set(events.flatMap(e => e.links.map(l => l.entityType))),
	);

	const visibleEvents = events.filter((event) => {
		if (actorFilter !== "all" && event.actor !== actorFilter) {
			return false;
		}
		return !(entityFilter !== "all"
			&& !event.links.some(link => link.entityType === entityFilter));
	});

	return (
		<div className={styles["timeline-panel"]}>
			<div className={styles.toolbar}>
				<FilterPills
					ariaLabel="Filter timeline by actor"
					value={actorFilter}
					onChange={setActorFilter}
					options={[
						{ value: "all", label: `All Actors (${events.length})` },
						{ value: "agent", label: "Agent" },
						{ value: "user", label: "User" },
					]}
				/>
				<ActionButton variant="primary" size="compact" onClick={onOpenNoteDialog}>
					+ Add Note
				</ActionButton>
			</div>

			{presentEntityTypes.length > 0 && (
				<div className={styles.filters}>
					<FilterPills
						ariaLabel="Filter timeline by linked entity"
						value={entityFilter}
						onChange={setEntityFilter}
						options={[
							{ value: "all", label: "All Entities" },
							...presentEntityTypes.map(type => ({
								value: type,
								label: type,
							})),
						]}
					/>
				</div>
			)}

			{visibleEvents.length === 0
				? (
						<EmptyState
							title="No timeline events match."
							detail="Domain milestones and custom notes linked via polymorphic timeline_links appear here."
						/>
					)
				: (
						<div className={styles.feed}>
							{visibleEvents.map(event => (
								<article key={event.id} className={styles.event}>
									<div className={styles.head}>
										<strong>{event.title}</strong>
										<div className={styles.badges}>
											<StatusBadge
												label={event.actor}
												tone={event.actor === "user" ? "info" : "neutral"}
											/>
											<StatusBadge label={event.eventType} />
											{scope === "group" && event.sessionId && (
												<StatusBadge
													label={sessionNames.get(event.sessionId) ?? event.sessionId}
												/>
											)}
											<StatusBadge label={formatShortTimestamp(event.createdAt)} />
										</div>
									</div>
									{event.summary && <p className={styles.summary}>{event.summary}</p>}
									{event.links.length > 0 && (
										<div className={styles.links}>
											{event.links.map((link, idx) => (
												<ActionButton
													key={`${link.entityType}-${link.entityId}-${idx}`}
													variant="subtle"
													size="compact"
													onClick={() => onNavigateLink(link)}
												>
													{link.label ?? `${link.entityType}:${link.entityId}`}
												</ActionButton>
											))}
										</div>
									)}
								</article>
							))}
						</div>
					)}
		</div>
	);
}
