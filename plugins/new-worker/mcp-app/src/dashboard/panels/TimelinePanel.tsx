import { useState } from "react";
import type { DashboardScope, SessionSummary, TimelineActor, TimelineEntityType, TimelineEvent, TimelineLink } from "@/shared/contracts.js";
import { cx, formatShortTimestamp } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { type FilterPillOption, FilterPills } from "@/ui/primitives/FilterPills.js";
import { describeTimelineEvent, filterTimelineEvents, formatEntityTypeLabel, formatTimelineClock, groupTimelineEventsByDate } from "./timelineModel.js";
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

/** Dashboard panel rendering chronological polymorphic timeline events along a vertical rail. */
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
	const hasSystemActor = events.some(e => e.actor === "system");

	const actorOptions: Array<FilterPillOption<ActorFilter>> = [
		{ value: "all", label: `All Actors (${events.length})` },
		{ value: "agent", label: "Agent" },
		{ value: "user", label: "User" },
		...(hasSystemActor ? [{ value: "system" as const, label: "System" }] : []),
	];

	const presentEntityTypes = Array.from(
		new Set(events.flatMap(e => e.links.map(l => l.entityType))),
	);

	const visibleEvents = filterTimelineEvents(events, actorFilter, entityFilter);
	const dayGroups = groupTimelineEventsByDate(visibleEvents);

	return (
		<div className={styles["timeline-panel"]}>
			<div className={styles.toolbar}>
				<FilterPills
					ariaLabel="Filter timeline by actor"
					value={actorFilter}
					onChange={setActorFilter}
					options={actorOptions}
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
								label: formatEntityTypeLabel(type),
							})),
						]}
					/>
				</div>
			)}

			{dayGroups.length === 0
				? (
						<EmptyState
							title="No timeline events match."
							detail="Domain milestones and custom notes linked via polymorphic timeline_links appear here."
						/>
					)
				: (
					<div className={styles.stream}>
						<ol role="list" className={styles.groups}
						    aria-label="Timeline events by date">
							{dayGroups.map(group => (
								<li key={group.dateKey} className={styles.group}>
									<div className={styles.day}>
										<span className={styles.datelabel}>{group.dateLabel}</span>
										<span className={styles.daycount}>
												{`${group.events.length} ${group.events.length === 1 ? "event" : "events"}`}
											</span>
									</div>

									<ol role="list" className={styles.track}>
										{group.events.map((event) => {
											const presentation = describeTimelineEvent(event);
											const isNote = event.eventType === "note";
											const sessionLabel = scope === "group" && event.sessionId
												? (sessionNames.get(event.sessionId) ?? event.sessionId)
												: null;

											return (
												<li
													key={event.id}
													className={cx(styles.entry, isNote && styles["-note"])}
												>
													<time
														className={styles.time}
														dateTime={event.createdAt}
														title={formatShortTimestamp(event.createdAt)}
													>
														{formatTimelineClock(event.createdAt)}
													</time>

													<div className={styles.rail} aria-hidden="true">
															<span
																className={cx(
																	styles.node,
																	styles[`-${presentation.tone}`],
																	styles[`-${presentation.shape}`],
																)}
															/>
													</div>

													<div className={styles.body}>
														<div className={styles.headline}>
															<span
																className={styles.title}>{event.title}</span>
															<div className={styles.meta}>
																	<span
																		className={cx(
																			styles.kind,
																			styles[`-${presentation.tone}`],
																		)}
																	>
																		{presentation.label}
																	</span>
																<span
																	className={cx(
																		styles.actor,
																		event.actor === "user" && styles["-user"],
																	)}
																>
																		{event.actor}
																	</span>
																{sessionLabel && (
																	<span
																		className={styles.session}>{sessionLabel}</span>
																)}
															</div>
														</div>

														{event.summary && (
															<p className={styles.summary}>{event.summary}</p>
														)}

														{event.links.length > 0 && (
															<div className={styles.links}>
																{event.links.map((link, idx) => (
																	<button
																		key={`${link.entityType}-${link.entityId}-${idx}`}
																		type="button"
																		className={styles.chip}
																		onClick={() => onNavigateLink(link)}
																	>
																		{link.label ?? `${formatEntityTypeLabel(link.entityType)} ${link.entityId}`}
																	</button>
																))}
															</div>
														)}
													</div>
												</li>
											);
										})}
									</ol>
								</li>
							))}
						</ol>
						</div>
					)}
		</div>
	);
}
